from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator

class Hall(models.Model):
    name = models.CharField(max_length=100, unique=True)
    rows = models.IntegerField(validators=[MinValueValidator(1)])
    cols = models.IntegerField(validators=[MinValueValidator(1)])
    
    # Add this line to store the layout carving data
    seating_grid = models.JSONField(default=list, blank=True) 

    def __str__(self):
        return f"{self.name} ({self.rows}x{self.cols})"

class Seat(models.Model):
    """
    Represents a specific seat within a hall.
    """
    hall = models.ForeignKey(Hall, on_delete=models.CASCADE, related_name='seats')
    row_index = models.IntegerField()
    col_index = models.IntegerField()
    
    # Coordinates are kept for database compatibility but the UI now uses Responsive Grid
    pos_x = models.FloatField(default=0.0)
    pos_y = models.FloatField(default=0.0)
    
    # Allows marking seats as 'BROKEN' so the algorithm skips them
    is_active = models.BooleanField(default=True)
    
    # NEW: Allows carving out hallways and custom PC layouts ('active', 'broken', 'space')
    seat_type = models.CharField(max_length=10, default='active') 

    class Meta:
        unique_together = ('hall', 'row_index', 'col_index')

class ExamSession(models.Model):
    """
    Modified: Now acts as a 'Room Map' container.
    Focuses on Hall and Time Range instead of Exam titles.
    """
    # Defaults provided so these aren't required in the Room Mapping UI
    title = models.CharField(max_length=200, blank=True, null=True, default="Room Mapping")
    date = models.DateField(auto_now_add=True)
    
    # Time Range to define sessions and prevent overlapping assignments
    time_range = models.CharField(max_length=50, default="9 to 11")
    
    hall = models.ForeignKey(Hall, on_delete=models.CASCADE, related_name='exams')
    is_allocated = models.BooleanField(default=False)
    retake_students = models.ManyToManyField('accounts.User', blank=True, related_name='retake_exams')

    class Meta:
        # Prevents creating two identical sessions in the same hall at the same time
        unique_together = ('hall', 'time_range')

class ExamCohort(models.Model):
    """
    Represents the student groups (WHO & WHAT) mapped to a room.
    """
    exam_session = models.ForeignKey(ExamSession, on_delete=models.CASCADE, related_name='cohorts')
    department = models.CharField(max_length=100)
    stage = models.IntegerField()
    
    # FIX: Re-added subject_name so it matches your MySQL database schema and prevents Error 1364
    subject_name = models.CharField(max_length=100, default='General')

class Allocation(models.Model):
    """
    The final record of which student sits in which seat.
    """
    exam_session = models.ForeignKey(ExamSession, on_delete=models.CASCADE, related_name='allocations')
    student = models.ForeignKey('accounts.User', on_delete=models.CASCADE)
    seat = models.ForeignKey(Seat, on_delete=models.CASCADE)

    class Meta:
        unique_together = (('exam_session', 'student'), ('exam_session', 'seat'))