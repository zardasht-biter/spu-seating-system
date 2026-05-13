from django.db import models
from django.contrib.auth.models import AbstractUser

class SystemSetting(models.Model):
    """
    Global system configurations. 
    id=1 is reserved for the master setting row.
    """
    test_mode_active = models.BooleanField(default=False)

    @classmethod
    def get_test_mode(cls):
        # Always fetches the single master setting row
        setting, _ = cls.objects.get_or_create(id=1)
        return setting.test_mode_active

class User(AbstractUser):
    ROLE_CHOICES = (('admin', 'Admin'), ('student', 'Student'))
    
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='student')
    stage = models.IntegerField(null=True, blank=True)
    department = models.CharField(max_length=100, null=True, blank=True)
    
    # REMOVED: full_name (System is now 100% email-based)
    
    profile_confirmed = models.BooleanField(default=False)
    otp = models.CharField(max_length=6, null=True, blank=True)

    # Granular Permissions: Stores a list of strings (e.g., ['ROSTER', 'HALLS', 'EXAMS'])
    # Only applicable if the user is an Admin
    permissions_json = models.JSONField(default=list, blank=True)

    def has_perm_to(self, action):
        """
        Helper method to check if an admin has the right to perform a specific action.
        Master Admins (Superusers) bypass all permission checks.
        """
        if self.is_superuser:
            return True
        return action in self.permissions_json

    def save(self, *args, **kwargs):
        # Strict SPU email validation logic
        # Master Admins and Proctors added by the Master can bypass domain checks
        if not self.is_staff and not self.is_superuser:
            test_mode = SystemSetting.get_test_mode()
            if not test_mode and not self.email.endswith('@spu.edu.iq'):
                raise ValueError("Only @spu.edu.iq emails are allowed unless Jury Mode is ON.")
        
        super().save(*args, **kwargs)

class StudentEnrollment(models.Model):
    """
    Links students to a specific department and stage.
    Tracks cross-stage enrollments via the is_retake flag.
    """
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='enrollments')
    department = models.CharField(max_length=100)
    stage = models.IntegerField()
    is_retake = models.BooleanField(default=False)

    class Meta:
        unique_together = ('student', 'department', 'stage')

    def __str__(self):
        return f"{self.student.email} - {self.department} Stage {self.stage}"