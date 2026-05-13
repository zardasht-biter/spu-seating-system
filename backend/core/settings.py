import os
from pathlib import Path
from dotenv import load_dotenv
import pymysql

# --- 1. MariaDB/MySQL Stability Bridge ---
# Required for XAMPP/MariaDB compatibility on Windows
pymysql.version_info = (1, 4, 3, "final", 0) 
pymysql.install_as_MySQLdb()

load_dotenv()
BASE_DIR = Path(__file__).resolve().parent.parent

# --- 2. Security & Environment ---
SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-spu-default-key')
DEBUG = os.environ.get('DEBUG') == 'True'
ALLOWED_HOSTS = ['*'] # Allows access via local IP during SPU presentation

# --- 3. Application Definition ---
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders', 
    'accounts',
    'seating',
    'algorithm',
    'reporting',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware', # Must stay at the top
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

# Fix for admin.E403: Ensures Admin panel templates load correctly
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'

# --- 4. Database (MariaDB/XAMPP Configuration) ---
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST', '127.0.0.1'),
        'PORT': os.environ.get('DB_PORT', '3306'),
        'OPTIONS': {'init_command': "SET sql_mode='STRICT_TRANS_TABLES'"},
    }
}

# --- 5. Authentication & Internationalization ---
AUTH_USER_MODEL = 'accounts.User'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

TIME_ZONE = 'Asia/Baghdad' # Local SPU Time
USE_I18N = True
USE_TZ = True

# --- 6. Static Files ---
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / "staticfiles"

# --- 7. Security & API Policies ---
CORS_ALLOW_ALL_ORIGINS = True # Fixes React-to-Django connection issues

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated', # Defense-ready security
    ]
}

# --- 8. SMTP Email (OTP Delivery) ---
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.environ.get('EMAIL_HOST')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD')
DEFAULT_FROM_EMAIL = f"SPU Seating System <{EMAIL_HOST_USER}>"