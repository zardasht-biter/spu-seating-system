from django.urls import path
from .views import RunAllocationView
urlpatterns = [
    path('run/<int:exam_session_id>/', RunAllocationView.as_view()),
]
