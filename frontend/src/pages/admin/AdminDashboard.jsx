import { useState, useEffect } from 'react';
import { Container, Tab, Tabs, Button, Navbar, Form, Table, Badge, Row, Col, Card, Spinner, Modal, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

// Importing SPU Project Tab Managers
import RosterManager from './RosterManager';
import HallsManager from './HallsManager';
import ExamsManager from './ExamsManager';
import AllocationManager from './AllocationManager';

const AdminDashboard = () => {
  const [key, setKey] = useState('roster');
  const [testMode, setTestMode] = useState(false);
  const [masterInfo, setMasterInfo] = useState({ master_email: '', is_current_user_master: false, current_user_id: null });
  const [allUsers, setAllUsers] = useState([]);

  // Permission Modal State
  const [showPermsModal, setShowPermsModal] = useState(false);
  const [targetUser, setTargetUser] = useState(null);
  const [selectedPerms, setSelectedPerms] = useState([]);

  // Form & Loading States
  const [newUser, setNewUser] = useState({ email: '', role: 'admin' });
  const [actionLoading, setActionLoading] = useState(false);
  const [systemLoading, setSystemLoading] = useState(true);
  
  const navigate = useNavigate();

  // Mapping to Backend Permission JSON logic
  const PERMISSION_KEYS = [
    { key: 'ROSTER', label: '1. Roster Sync & Student Database' },
    { key: 'HALLS', label: '2. Hall Layouts & Grid Carving' },
    { key: 'EXAMS', label: '3. Exam Session Mapping' },
    { key: 'ALLOCATION', label: '4. Seating Algorithm (Trio-Zebra)' },
    { key: 'REPORTS', label: '5. PDF Generation (Seat Cards & Lists)' }
  ];

  useEffect(() => {
    fetchSystemData();
  }, []);

  const fetchSystemData = async () => {
    setSystemLoading(true);
    try {
      const [testRes, masterRes, usersRes] = await Promise.all([
        api.get('/accounts/system/test-mode/'),
        api.get('/accounts/system/master-admin/'),
        api.get('/accounts/system/users/')
      ]);
      setTestMode(testRes.data.test_mode_active);
      setMasterInfo(masterRes.data);
      setAllUsers(usersRes.data);
    } catch (err) {
      console.error("System Data Load Error:", err);
    } finally {
      setSystemLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await api.post('/accounts/system/users/create/', newUser);
      alert(res.data.message);
      setNewUser({ email: '', role: 'admin' });
      fetchSystemData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to add user.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleKick = async (userId) => {
    if (window.confirm("CRITICAL SECURITY ACTION: Purge this user? All system access will be revoked immediately.")) {
        try {
            await api.post('/accounts/system/users/kick/', { user_id: userId });
            fetchSystemData();
        } catch (err) { alert(err.response?.data?.error || "Purge operation failed."); }
    }
  };

  const handleMakeMaster = async (userId) => {
    const msg = "SECURITY WARNING: You are granting FULL MASTER STATUS. This user will have the power to delete you. Proceed?";
    if (window.confirm(msg)) {
        try {
            await api.post('/accounts/system/users/make-master/', { user_id: userId });
            fetchSystemData();
        } catch (err) { alert(err.response?.data?.error || "Promotion failed."); }
    }
  };

  const savePermissions = async () => {
    try {
        await api.post('/accounts/system/users/update-perms/', { 
            user_id: targetUser.id, 
            permissions: selectedPerms 
        });
        setShowPermsModal(false);
        fetchSystemData();
        alert("Permissions updated.");
    } catch (err) { alert("Failed to sync permissions."); }
  };

  const toggleTestMode = async () => {
    try {
      const res = await api.post('/accounts/system/test-mode/');
      setTestMode(res.data.test_mode_active);
    } catch (err) {
      alert("Failed to toggle Presentation Mode.");
    }
  };

  const handleAcademicReset = async () => {
    if (window.confirm("CRITICAL: Wipe all enrollment and allocation history? This cannot be undone.")) {
      try {
        const res = await api.post('/accounts/profile/reset/');
        alert(res.data.message);
        fetchSystemData();
      } catch (err) { alert("Reset failed."); }
    }
  };

  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      {/* MOBILE OPTIMIZED NAVBAR */}
      <Navbar bg="dark" variant="dark" className="px-2 px-md-4 shadow-sm mb-4">
        <Container fluid className="px-0 d-flex flex-nowrap align-items-center">
          <Navbar.Brand className="fw-bold fs-6 fs-md-4 text-truncate me-auto" style={{ maxWidth: '50%' }}>
            SPU Command Center
          </Navbar.Brand>
          
          <div className="d-flex align-items-center gap-2">
            <Badge bg={testMode ? "warning" : "success"} style={{ fontSize: '0.65rem' }} className="text-wrap text-center">
              {testMode ? "JURY MODE" : "STRICT SPU"}
            </Badge>
            <Button 
              variant="outline-danger" 
              size="sm" 
              className="py-1 px-2"
              style={{ fontSize: '0.8rem' }}
              onClick={() => { localStorage.removeItem('user'); navigate('/login'); }}
            >
              Logout
            </Button>
          </div>
        </Container>
      </Navbar>

      <Container className="bg-white p-2 p-md-4 rounded shadow-sm mb-5">
        <Tabs activeKey={key} onSelect={(k) => setKey(k)} className="mb-4" fill>
          <Tab eventKey="roster" title="Roster Sync"><RosterManager activeTab={key} /></Tab>
          <Tab eventKey="halls" title="Hall Grids"><HallsManager activeTab={key} /></Tab>
          <Tab eventKey="exams" title="Sessions"><ExamsManager activeTab={key} /></Tab>
          <Tab eventKey="allocations" title="Seating Maps"><AllocationManager activeTab={key} /></Tab>
          
          <Tab eventKey="tools" title="Master Tools">
            <div className="p-3 p-md-4 border rounded bg-white shadow-sm mb-4">
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 border-bottom pb-2 gap-3">
                <h4 className="text-primary fw-bold mb-0 fs-5 fs-md-4">Identity & Privilege Manager</h4>
                <div className="text-md-end w-100 w-md-auto">
                  <small className="text-muted d-block">Current System Master:</small>
                  <Badge bg="dark" className="px-3 py-2 w-100 w-md-auto text-truncate">{masterInfo.master_email}</Badge>
                </div>
              </div>

              <Card className="bg-light border-0 mb-4 shadow-sm p-3">
                <h6 className="fw-bold mb-3">Pre-Authorize Admin Account</h6>
                <Form onSubmit={handleAddUser}>
                  {/* MOBILE OPTIMIZED FORM ROW */}
                  <Row className="g-3 align-items-end">
                    <Col xs={12} lg={6}>
                      <Form.Label className="small text-muted mb-1">Email Address</Form.Label>
                      <Form.Control 
                        placeholder="Admin Email Address" 
                        value={newUser.email} 
                        onChange={e => setNewUser({...newUser, email: e.target.value})} 
                        required 
                        disabled={!masterInfo.is_current_user_master}
                      />
                    </Col>
                    <Col xs={12} sm={6} lg={3}>
                      <Form.Label className="small text-muted mb-1">Role</Form.Label>
                      <Form.Select 
                        value={newUser.role} 
                        onChange={e => setNewUser({...newUser, role: e.target.value})} 
                        disabled={!masterInfo.is_current_user_master}
                      >
                        <option value="admin">Admin / Proctor</option>
                      </Form.Select>
                    </Col>
                    <Col xs={12} sm={6} lg={3}>
                      <Button variant="primary" type="submit" className="w-100 fw-bold" disabled={!masterInfo.is_current_user_master || actionLoading}>
                        {actionLoading ? "..." : "Create Identity"}
                      </Button>
                    </Col>
                  </Row>
                </Form>
              </Card>

              <div className="table-responsive">
                <Table hover className="border-top">
                  <thead className="bg-light text-muted small text-uppercase">
                    <tr>
                      <th>Email Identity</th>
                      <th>Role</th>
                      <th className="text-center">Admin Commands</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.filter(user => user.role === 'admin').map(user => (
                      <tr key={user.id} className="align-middle">
                        <td className="fw-bold text-break" style={{ minWidth: '150px' }}>{user.email}</td>
                        <td>
                          <Badge bg={user.role === 'admin' ? 'primary' : 'secondary'}>
                            {user.role.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="text-center">
                          {user.id === masterInfo.current_user_id ? (
                              <Badge bg="success" className="px-3 py-2 w-100 w-md-auto">YOU (OWNER)</Badge>
                          ) : (
                            <div className="d-flex flex-wrap gap-1 justify-content-center">
                               {masterInfo.is_current_user_master ? (
                                <>
                                  {!user.is_superuser && (
                                    <>
                                      <Button variant="outline-primary" size="sm" className="flex-fill" onClick={() => {
                                          setTargetUser(user);
                                          setSelectedPerms(user.permissions_json || []);
                                          setShowPermsModal(true);
                                      }}>Perms</Button>
                                      <Button variant="outline-warning" size="sm" className="flex-fill" onClick={() => handleMakeMaster(user.id)}>Master</Button>
                                    </>
                                  )}
                                  <Button variant="danger" size="sm" className="flex-fill" onClick={() => handleKick(user.id)}>Purge</Button>
                                </>
                              ) : (
                                <Badge bg="secondary" className="w-100 w-md-auto">Restricted</Badge>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>

            <Row className="g-4">
              <Col xs={12} md={6}>
                <Card className="shadow-sm border-0 h-100 p-3">
                  <h5 className="fw-bold text-primary">Presentation Mode</h5>
                  <p className="text-muted small">Allow registration from non-SPU domains during the defense.</p>
                  <Form.Check type="switch" label={testMode ? "JURY MODE ACTIVE" : "STRICT DOMAIN LOCK"} checked={testMode} onChange={toggleTestMode} className="fs-5 mt-2" />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card className="shadow-sm border-danger border-opacity-25 h-100 p-3">
                  <h5 className="fw-bold text-danger">Cycle Reset</h5>
                  <p className="text-muted small">Permanently clear enrollments and seating data for the next semester.</p>
                  <Button variant="outline-danger" className="fw-bold mt-2 w-100 w-md-auto" onClick={handleAcademicReset}>Execute Semester Wipe</Button>
                </Card>
              </Col>
            </Row>
          </Tab>
        </Tabs>
      </Container>

      {/* PERMISSIONS MODAL */}
      <Modal show={showPermsModal} onHide={() => setShowPermsModal(false)} centered>
          <Modal.Header closeButton className="bg-primary text-white">
              <Modal.Title className="fs-5 text-truncate" style={{ maxWidth: '90%' }}>Privilege Mapping: {targetUser?.email}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
              {targetUser?.is_superuser ? (
                  <Alert variant="success" className="fw-bold">
                    This account is a Master Admin. All modules are unlocked inherently.
                  </Alert>
              ) : (
                  <>
                    <p className="text-muted small mb-3">Check the modules this admin is authorized to manage:</p>
                    {PERMISSION_KEYS.map(p => (
                        <Form.Check 
                            key={p.key}
                            type="checkbox"
                            label={p.label}
                            checked={selectedPerms.includes(p.key)}
                            onChange={(e) => {
                                const newPerms = e.target.checked 
                                  ? [...selectedPerms, p.key] 
                                  : selectedPerms.filter(k => k !== p.key);
                                setSelectedPerms(newPerms);
                            }}
                            className="mb-2 fw-bold"
                        />
                    ))}
                  </>
              )}
          </Modal.Body>
          <Modal.Footer>
              <Button variant="primary" className="w-100 fw-bold" onClick={savePermissions} disabled={targetUser?.is_superuser}>
                Synchronize Permissions
              </Button>
          </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminDashboard;