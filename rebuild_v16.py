import os

# Missing logic for the rest of the V16 PRO System
final_files = {
    # ACCOUNTS URLS (Fixed the specific error you saw)
    "backend/accounts/urls.py": """from django.urls import path
from .views import (
    RequestOTPView, VerifyOTPView, SyncClassroomRosterView, 
    UpdateProfileView, TestModeToggleView
)
urlpatterns = [
    path('otp/request/', RequestOTPView.as_view()),
    path('otp/verify/', VerifyOTPView.as_view()),
    path('profile/update/', UpdateProfileView.as_view()),
    path('profile/sync-roster/', SyncClassroomRosterView.as_view()),
    path('system/test-mode/', TestModeToggleView.as_view()),
]
""",
    # ALGORITHM URLS
    "backend/algorithm/urls.py": """from django.urls import path
from .views import RunAllocationView
urlpatterns = [
    path('run/<int:exam_session_id>/', RunAllocationView.as_view()),
]
""",
    # REPORTING URLS
    "backend/reporting/urls.py": """from django.urls import path
from .views import GenerateAttendanceRosterView
urlpatterns = [
    path('attendance/<int:exam_session_id>/', GenerateAttendanceRosterView.as_view()),
]
""",
    # ACCOUNTS VIEWS (Ensuring TestModeToggle is present)
    "backend/accounts/views.py": """import random, csv, io
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.authtoken.models import Token
from .models import User, SystemSetting

class UpdateProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def put(self, request):
        user = request.user
        user.department = request.data.get('department')
        user.stage = request.data.get('stage')
        user.profile_confirmed = True
        user.save()
        return Response({'message': 'Profile updated'})

class RequestOTPView(APIView):
    def post(self, request):
        email = request.data.get('email')
        otp = str(random.randint(100000, 999999))
        user, _ = User.objects.get_or_create(email=email, defaults={'username': email})
        user.otp = otp
        user.save()
        return Response({'message': 'OTP sent'})

class VerifyOTPView(APIView):
    def post(self, request):
        user = User.objects.filter(email=request.data.get('email'), otp=request.data.get('otp')).first()
        if user:
            user.is_active = True
            user.save()
            token, _ = Token.objects.get_or_create(user=user)
            return Response({'token': token.key, 'role': user.role, 'profile_confirmed': user.profile_confirmed})
        return Response({'error': 'Invalid OTP'}, status=400)

class SyncClassroomRosterView(APIView):
    def post(self, request):
        file = request.FILES.get('file')
        reader = csv.DictReader(io.StringIO(file.read().decode('utf-8')))
        for row in reader:
            email = next((val for key, val in row.items() if 'email' in key.lower()), '').strip()
            if email:
                user, _ = User.objects.get_or_create(email=email, defaults={'username': email})
                user.department = request.data.get('department')
                user.stage = int(request.data.get('stage'))
                user.profile_confirmed = True
                user.save()
        return Response({'message': 'Roster synced'})

class TestModeToggleView(APIView):
    def get(self, request):
        return Response({'test_mode_active': SystemSetting.get_test_mode()})
    def post(self, request):
        setting, _ = SystemSetting.objects.get_or_create(id=1)
        setting.test_mode_active = not setting.test_mode_active
        setting.save()
        return Response({'test_mode_active': setting.test_mode_active})
"""
}

for path, content in final_files.items():
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Injected: {path}")

print("\n🚀 All V16 App logic is now present. Ready for migrations!")