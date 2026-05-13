import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';

// Core Pages
import Login from './pages/Login';
import StudentDashboard from './pages/student/StudentDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';

function App() {
  return (
    <>
      {/* Mobile Optimization Styles for Admin Navigation & Tables */}
      <style>{`
        /* The ultimate white-gap killer */
        html, body, #root {
          overflow-x: hidden !important;
          width: 100vw !important;
          max-width: 100%;
        }

        @media (max-width: 768px) {
          /* Smooth horizontal scrolling for main admin tabs */
          .nav-tabs {
            display: flex !important;
            flex-wrap: nowrap !important;
            overflow-x: auto !important;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            border-bottom: none;
            padding-bottom: 5px;
          }
          .nav-tabs::-webkit-scrollbar { height: 4px; }
          .nav-tabs::-webkit-scrollbar-thumb { background-color: #dee2e6; border-radius: 4px; }
          .nav-tabs .nav-item { white-space: nowrap; }
          
          /* Force tables to scroll instead of breaking the screen */
          .table-responsive {
            border: 0 !important;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          
          /* Stack action buttons in tables so they don't stretch the width */
          td .d-flex {
            flex-wrap: wrap;
            gap: 0.5rem !important;
          }

          /* Prevent Hall Carver from bleeding off-screen */
          .hall-carver-container {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 15px;
          }

          /* Add spacing between stacked columns */
          .row { margin-bottom: 1rem; }
        }
      `}</style>

      <Router>
        <Routes>
          {/* Login Page */}
          <Route path="/login" element={<Login />} />
          
          {/* The Main Admin Dashboard (This contains all 5 tabs) */}
          <Route path="/admin" element={<AdminDashboard />} />

          {/* Student Portal */}
          <Route path="/student" element={<StudentDashboard />} />

          {/* Default Redirect & Catch-all for broken paths like /profile-setup */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;