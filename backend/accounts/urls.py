from django.urls import path
from .views import (
    RequestOTPView, 
    VerifyOTPView, 
    UpdateProfileView,
    SyncClassroomRosterView, 
    SubjectListView, 
    StudentProfileListView,
    AddManualStudentView, 
    BulkDeleteStudentsView, 
    WipeFilteredStudentsView,
    MasterAdminInfoView, 
    AdminUserListView, 
    AdminCreateUserView,
    UpdatePermissionsView, 
    GrantMasterStatusView, 
    DeleteUserView,
    TestModeToggleView, 
    ResetStudentProfilesView
)

urlpatterns = [
    # --- 1. Authentication & OTP Flow ---
    path('otp/request/', RequestOTPView.as_view(), name='otp-request'),
    path('otp/verify/', VerifyOTPView.as_view(), name='otp-verify'),
    path('profile/update/', UpdateProfileView.as_view(), name='profile-update'),

    # --- 2. Student & Roster Management ---
    path('profile/sync-roster/', SyncClassroomRosterView.as_view(), name='sync-roster'),
    path('profile/subjects/', SubjectListView.as_view(), name='subject-list'),
    path('profile/list/', StudentProfileListView.as_view(), name='student-list-table'),
    path('profile/add-manual/', AddManualStudentView.as_view(), name='add-manual'),
    path('profile/bulk-delete/', BulkDeleteStudentsView.as_view(), name='bulk-delete'),
    path('profile/wipe-filtered/', WipeFilteredStudentsView.as_view(), name='wipe-filtered'),
    
    # --- 3. Master Admin Command Center ---
    # Primary owner identification
    path('system/master-admin/', MasterAdminInfoView.as_view(), name='master-admin'),
    
    # User database oversight
    path('system/users/', AdminUserListView.as_view(), name='admin-user-list'),
    
    # Manual user injection
    path('system/users/create/', AdminCreateUserView.as_view(), name='admin-create-user'),
    
    # Granular permission mapping
    path('system/users/update-perms/', UpdatePermissionsView.as_view(), name='update-perms'),
    
    # Master status promotion
    path('system/users/make-master/', GrantMasterStatusView.as_view(), name='make-master'),
    
    # Account purge/kick logic
    path('system/users/kick/', DeleteUserView.as_view(), name='kick-user'),

    # --- 4. System Settings & Maintenance ---
    path('system/test-mode/', TestModeToggleView.as_view(), name='test-mode'),
    path('profile/reset/', ResetStudentProfilesView.as_view(), name='profile-reset'),
]