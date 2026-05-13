import random
import io
import csv
import re
import pandas as pd
from datetime import date, time
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.authtoken.models import Token
from django.core.mail import send_mail
from django.db import transaction
from .models import User, SystemSetting, StudentEnrollment
from seating.models import Allocation

# --- 1. USER PROFILE & AUTHENTICATION ---

class UpdateProfileView(APIView):
    """Allows students to confirm their SPU identity details."""
    permission_classes = [permissions.IsAuthenticated]
    def put(self, request):
        user = request.user
        user.department = request.data.get('department', '').strip().upper()
        user.stage = request.data.get('stage')
        user.profile_confirmed = True
        user.save()
        return Response({'message': 'Profile updated successfully'})

class RequestOTPView(APIView):
    """Generates login codes with a bypass for Master Admins or Jury Test Mode."""
    authentication_classes = [] 
    permission_classes = [permissions.AllowAny]
    def post(self, request):
        email = request.data.get('email', '').strip()
        user_check = User.objects.filter(email=email).first()
        
        # Privilege check: Masters and manually authorized proctors bypass domain restrictions
        is_privileged = user_check and (user_check.is_staff or user_check.is_superuser)
        test_mode = SystemSetting.get_test_mode()

        if not email.endswith('@spu.edu.iq') and not is_privileged and not test_mode:
            return Response({'error': 'Strict SPU email required.'}, status=status.HTTP_403_FORBIDDEN)

        otp_code = str(random.randint(100000, 999999))
        user, _ = User.objects.get_or_create(email=email, defaults={'username': email, 'is_active': False})
        user.otp = otp_code
        user.save()

        # Terminal output for local development/demonstration environments
        print(f"\n=========================================")
        print(f"🔒 LOGIN OTP FOR {email} IS: {otp_code}")
        print(f"=========================================\n")

        try:
            send_mail(
                'SPU Seating Verification',
                f'Your login OTP is: {otp_code}',
                'noreply@spu.edu.iq', 
                [email],
                fail_silently=False,
            )
        except Exception:
            print(f"SMTP Error. Use OTP from terminal.")

        return Response({'message': 'OTP generated. Check terminal or email.'})

class VerifyOTPView(APIView):
    """Validates OTP and synchronizes roles with administrative permissions."""
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    def post(self, request):
        email = request.data.get('email')
        otp = request.data.get('otp')
        try:
            user = User.objects.get(email=email, otp=otp)
            
            # Sync role if the Master Admin has granted staff or superuser status
            if user.is_superuser or user.is_staff:
                user.role = 'admin'
            
            user.is_active = True
            user.otp = None
            user.save()
            
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'role': user.role,
                'profile_confirmed': user.profile_confirmed,
                'email': user.email,
                
                # ADD THESE TWO LINES:
                'department': user.department,
                'stage': user.stage
            })
        except User.DoesNotExist:
            return Response({'error': 'Invalid OTP.'}, status=status.HTTP_400_BAD_REQUEST)
# --- 2. ROSTER & ENROLLMENT MANAGEMENT ---

class SubjectListView(APIView):
    """Deprecated: Kept temporarily to prevent urls.py from breaking during transition."""
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        return Response([])

class StudentProfileListView(APIView):
    """Populates the Roster table with students enrolled in a selected department and stage."""
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        # VISIBILITY: Allow all staff to view the roster list
        if not request.user.is_staff and not request.user.is_superuser:
            return Response(status=403)

        dept = request.GET.get('department')
        stage = request.GET.get('stage')
        
        if not dept or not stage: return Response([])
        
        enrollments = StudentEnrollment.objects.filter(
            department=dept, stage=stage
        ).select_related('student')
        
        data = [{
            'id': e.student.id, 
            'email': e.student.email, 
            'is_retake': e.is_retake
        } for e in enrollments]
        return Response(data)
    
class SyncClassroomRosterView(APIView):
    """Bulk-enrolls students via Smart Regex File Extraction (Email Only) and detects retakes."""
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        # SECURITY: Modification requires the ROSTER permission
        if not request.user.has_perm_to('ROSTER'):
            return Response({'error': 'Unauthorized. ROSTER permission required.'}, status=403)

        file = request.FILES.get('file')
        dept = request.data.get('department', '').strip().upper()
        stage_str = request.data.get('stage')
        
        if not file or not stage_str: return Response({'error': 'Missing file or stage.'}, status=400)

        try:
            stage = int(stage_str)
            file.seek(0)
            file_bytes = file.read()
            rows = []

            # Universal Headerless File Parser
            if file.name.lower().endswith('.csv'):
                try:
                    decoded_file = file_bytes.decode('utf-8-sig')
                except UnicodeDecodeError:
                    decoded_file = file_bytes.decode('latin1')
                
                try:
                    dialect = csv.Sniffer().sniff(decoded_file[:2048])
                except Exception:
                    dialect = csv.excel
                    
                reader = csv.reader(io.StringIO(decoded_file), dialect)
                rows = list(reader)
                
            elif file.name.lower().endswith(('.xls', '.xlsx')):
                df = pd.read_excel(io.BytesIO(file_bytes), header=None)
                df = df.fillna('')
                rows = df.values.tolist()
            else:
                return Response({'error': 'Please upload a CSV or Excel file.'}, status=400)

            saved_count = 0
            
            # Smart Regex Data Extraction (Email Only)
            for row in rows:
                row_text = " | ".join([str(c).strip() for c in row if pd.notna(c) and str(c).strip() != ''])
                
                # Extract Email using precise Regex
                email_match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', row_text)
                
                if not email_match:
                    continue 
                
                email = email_match.group(0).lower()

                # 1. Create or get user
                user, created = User.objects.get_or_create(
                    email=email, 
                    defaults={'username': email, 'role': 'student', 'department': dept, 'stage': stage}
                )

                # 2. Retake Detection
                existing_stages = StudentEnrollment.objects.filter(student=user, department=dept).exclude(stage=stage).exists()
                
                # 3. Save Enrollment
                enrollment, created_enr = StudentEnrollment.objects.get_or_create(
                    student=user, 
                    department=dept,
                    stage=stage,
                    defaults={'is_retake': existing_stages}
                )
                
                if existing_stages:
                    StudentEnrollment.objects.filter(student=user, department=dept).update(is_retake=True)

                saved_count += 1
            
            if saved_count == 0:
                return Response({'error': 'No valid emails found in the file.'}, status=400)
                
            return Response({'message': f'Successfully synced {saved_count} students.'})
        except Exception as e: return Response({'error': str(e)}, status=400)

class AddManualStudentView(APIView):
    """Injects a single student into the database and enrolls them."""
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        # SECURITY: Modification requires the ROSTER permission
        if not request.user.has_perm_to('ROSTER'):
            return Response({'error': 'Unauthorized. ROSTER permission required.'}, status=403)

        email = request.data.get('email', '').strip()
        dept = request.data.get('department', '').strip().upper()
        stage = request.data.get('stage')
        
        user, _ = User.objects.get_or_create(
            email=email, 
            defaults={'username': email, 'role': 'student', 'department': dept, 'stage': int(stage)}
        )
        
        existing_stages = StudentEnrollment.objects.filter(student=user, department=dept).exclude(stage=int(stage)).exists()
            
        StudentEnrollment.objects.get_or_create(
            student=user, department=dept, stage=int(stage), defaults={'is_retake': existing_stages}
        )
        
        if existing_stages:
            StudentEnrollment.objects.filter(student=user, department=dept).update(is_retake=True)
            
        return Response({'message': f'{email} added to roster.'})

# --- 3. COMMAND CENTER: MASTER ADMIN & PERMISSIONS ---

class MasterAdminInfoView(APIView):
    """Identifies the primary system owner based on the initial setup."""
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        master = User.objects.filter(is_superuser=True).order_by('date_joined').first()
        return Response({
            'master_email': master.email if master else "None",
            'is_current_user_master': request.user == master or request.user.is_superuser,
            'current_user_id': request.user.id
        })

class AdminUserListView(APIView):
    """Retrieves all users with their permission maps for the Command Center."""
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        # VISIBILITY: Allow all staff to see the identity list
        if not request.user.is_staff and not request.user.is_superuser:
            return Response(status=403)
        users = User.objects.all().order_by('-is_superuser', 'email')
        data = [{
            'id': u.id, 
            'email': u.email, 
            'role': u.role,
            'is_superuser': u.is_superuser,
            'permissions_json': u.permissions_json
        } for u in users]
        return Response(data)

class AdminCreateUserView(APIView):
    """Allows Master Admins to manually authorize users from any domain."""
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        # SECURITY: Only Master Admin can create other Admin identities
        if not request.user.is_superuser: 
            return Response({'error': 'Unauthorized. Master Admin only.'}, status=403)

        email = request.data.get('email', '').strip()
        role = request.data.get('role', 'admin')
        if User.objects.filter(email=email).exists(): return Response({'error': 'User already exists.'}, status=400)
        
        User.objects.create(email=email, username=email, role=role, is_staff=(role == 'admin'), is_active=True)
        return Response({'message': f'Successfully authorized {email} as {role.upper()}.'})

class UpdatePermissionsView(APIView):
    """Syncs granular permission modules to an administrative account."""
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        # SECURITY: Only Master Admin can modify privilege maps
        if not request.user.is_superuser: 
            return Response({'error': 'Unauthorized. Master Admin only.'}, status=403)

        user = User.objects.get(id=request.data.get('user_id'))
        user.permissions_json = request.data.get('permissions', [])
        user.save()
        return Response({'message': 'Permissions synchronized.'})

class GrantMasterStatusView(APIView):
    """Promotes an account to Master Admin (Superuser) status."""
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        # SECURITY: Only Master Admin can promote others to Master status
        if not request.user.is_superuser: 
            return Response({'error': 'Unauthorized. Master Admin only.'}, status=403)

        target = User.objects.get(id=request.data.get('user_id'))
        target.is_superuser = True
        target.is_staff = True
        target.role = 'admin'
        target.save()
        return Response({'message': f'Full Master status granted to {target.email}.'})

class DeleteUserView(APIView):
    """Master Admin tool to purge accounts. Includes safety checks for system ownership."""
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        # SECURITY: Only Master Admin can purge identities
        if not request.user.is_superuser: 
            return Response({'error': 'Unauthorized. Master Admin only.'}, status=403)

        target = User.objects.get(id=request.data.get('user_id'))
        
        # Prevent total system lockout
        if target.is_superuser and User.objects.filter(is_superuser=True).count() <= 1:
            return Response({'error': 'Operation denied. Cannot kick the final Master Admin.'}, status=400)
            
        target.delete()
        return Response({'message': 'User successfully purged from the system.'})

# --- 4. SYSTEM SETTINGS & MAINTENANCE ---

class TestModeToggleView(APIView):
    """Enables Jury Mode to bypass university domain restrictions for demos."""
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request): 
        # VISIBILITY: Allow all staff to see mode status
        if not request.user.is_staff and not request.user.is_superuser:
            return Response(status=403)
        return Response({'test_mode_active': SystemSetting.get_test_mode()})

    def post(self, request):
        # Only admins/staff can toggle the mode
        if not request.user.is_staff and not request.user.is_superuser: return Response(status=403)
        setting, _ = SystemSetting.objects.get_or_create(id=1)
        setting.test_mode_active = not setting.test_mode_active
        setting.save()
        return Response({'test_mode_active': setting.test_mode_active})

class ResetStudentProfilesView(APIView):
    """Executes a full wipe of student academic progress while preserving accounts."""
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        # Only high-level staff/masters can execute academic resets
        if not request.user.is_staff and not request.user.is_superuser: return Response(status=403)
        with transaction.atomic():
            User.objects.filter(role='student').update(profile_confirmed=False, stage=None, department=None)
            StudentEnrollment.objects.all().delete()
            Allocation.objects.all().delete()
        return Response({'message': 'Academic Year Reset complete. Historical seating and enrollments cleared.'})

class BulkDeleteStudentsView(APIView):
    """Handles standard database cleanup for student accounts."""
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        # SECURITY: Deletion requires the ROSTER permission
        if not request.user.has_perm_to('ROSTER'):
            return Response({'error': 'Unauthorized. ROSTER permission required.'}, status=403)

        mode = request.data.get('mode')
        if mode == 'all':
            User.objects.filter(role='student').delete()
        elif mode == 'single':
            User.objects.filter(id=request.data.get('id')).delete()
        return Response({'message': 'Deletion operation successful.'})

class WipeFilteredStudentsView(APIView):
    """Surgically removes students based on specific department or stage parameters."""
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        # SECURITY: Deletion requires the ROSTER permission
        if not request.user.has_perm_to('ROSTER'):
            return Response({'error': 'Unauthorized. ROSTER permission required.'}, status=403)

        dept = request.data.get('department', '').upper()
        stage = request.data.get('stage')
        
        # Delete enrollments for this stage
        StudentEnrollment.objects.filter(department=dept, stage=int(stage)).delete()
        
        # Clean up orphaned users who have no enrollments left
        User.objects.filter(role='student', enrollments__isnull=True).delete()
        
        return Response({'message': 'Surgical wipe of filtered student data complete.'})
    

class StudentSeatView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        allocations = Allocation.objects.filter(student=request.user).select_related('exam_session', 'seat', 'exam_session__hall')
        data = [{
            'id': a.id,
            'exam_details': {
                'title': a.exam_session.title or "Session", 
                'hall_name': a.exam_session.hall.name, 
                'date': str(a.exam_session.date), 
                'start_time': a.exam_session.time_range,
                'hall_rows': a.exam_session.hall.rows,  # NEW
                'hall_cols': a.exam_session.hall.cols   # NEW
            },
            'seat_details': {
                'row_index': a.seat.row_index + 1 if a.seat else 0, 
                'col_index': a.seat.col_index + 1 if a.seat else 0
                # We can safely remove pos_x and pos_y here
            }
        } for a in allocations]
        return Response(data)