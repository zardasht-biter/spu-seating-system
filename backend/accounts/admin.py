from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, SystemSetting, StudentEnrollment

class CustomUserAdmin(UserAdmin):
    model = User
    list_display = ['email', 'username', 'role', 'department', 'stage', 'is_staff']
    fieldsets = UserAdmin.fieldsets + (
        ('SPU Info', {'fields': ('role', 'stage', 'department', 'profile_confirmed', 'otp')}),
    )

class StudentEnrollmentAdmin(admin.ModelAdmin):
    list_display = ['student', 'department', 'stage', 'is_retake']
    list_filter = ['department', 'stage', 'is_retake']
    search_fields = ['student__email', 'department']

admin.site.register(User, CustomUserAdmin)
admin.site.register(SystemSetting)
admin.site.register(StudentEnrollment, StudentEnrollmentAdmin)