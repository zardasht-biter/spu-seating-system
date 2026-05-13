import { useState, useEffect } from 'react';
import { Table, Button, Spinner, Badge, Modal } from 'react-bootstrap';
import api from '../../services/api';
import HallVisualizer from './HallVisualizer';

const AllocationManager = ({ activeTab }) => {
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [selectedExamId, setSelectedExamId] = useState(null);

    useEffect(() => { 
        // Automatic refresh when the user switches to this tab
        if (!activeTab || activeTab === 'allocations') {
            fetchData(); 
        }
    }, [activeTab]);

    const fetchData = async () => { 
        try {
            const res = await api.get('/seating/exams/');
            setExams(res.data); 
        } catch (err) {
            console.error("Error loading allocation data:", err);
        }
    };

    const runAllocation = async (examId) => {
        setLoading(examId);
        try {
            // Triggers the Backend Vertical Staggering Engine
            await api.post(`/algorithm/run/${examId}/`);
            fetchData(); // Refresh table to show updated counts
        } catch (err) { 
            alert(err.response?.data?.error || "Allocation engine error");
        } finally { 
            setLoading(null);
        }
    };

    const openVisualAudit = (examId) => {
        setSelectedExamId(examId);
        setShowModal(true);
    };

    return (
        <>
            <div className="mb-4">
                <h4 className="fw-bold text-primary">Exam Allocation & Autofill Optimization</h4>
                <p className="text-muted small">Monitor seat usage and handle overflows from assigned cohorts.</p>
            </div>

            {/* Mobile Optimized: table-responsive allows horizontal scrolling on Poco F7/Mobile */}
            <div className="table-responsive">
                <Table hover className="bg-white shadow-sm rounded border-0">
                    <thead className="bg-light text-uppercase small fw-bold">
                        <tr>
                            <th>Optimization Status</th>
                            <th>Hall</th>
                            <th>Main Cohorts</th>
                            <th>Seating Progress</th>
                            <th>Zebra Engine</th>
                            <th>Blueprint</th>
                        </tr>
                    </thead>
                    <tbody>
                        {exams.map(e => {
                            const hasWaitlist = e.is_allocated && e.waiting_list_count > 0;
                            const hasEmptySeats = e.is_allocated && e.empty_seats > 0;
                            
                            return (
                                <tr key={e.id} className="align-middle">
                                    <td>
                                        {hasWaitlist ? (
                                            <Badge bg="warning" text="dark" className="p-2 border border-warning shadow-sm">
                                                ⚠️ OVERFLOW: {e.waiting_list_count} Left
                                            </Badge>
                                        ) : hasEmptySeats ? (
                                            <Button 
                                                variant="link" 
                                                size="sm" 
                                                className="p-0 text-decoration-none text-primary fw-bold"
                                                onClick={() => alert("Go to '3. Exams' to add a cohort and fill these " + e.empty_seats + " seats.")}
                                            >
                                                + Optimize: {e.empty_seats} Empty
                                            </Button>
                                        ) : e.is_allocated ? (
                                            <span className="text-muted small">Fully Optimized</span>
                                        ) : (
                                            <span className="text-muted small">Ready to Seat</span>
                                        )}
                                    </td>
                                    <td><span className="fw-bold text-uppercase">{e.hall_name}</span></td>
                                    <td>
                                        {e.cohorts_list?.map((c, i) => (
                                            <Badge key={i} bg="info" className="me-1 mb-1">
                                                {c.department}-S{c.stage}
                                            </Badge>
                                        ))}
                                    </td>
                                    <td>
                                        {e.is_allocated ? (
                                            <div>
                                                <Badge bg="success" className="mb-1 w-100">Seated: {e.allocated_count}</Badge>
                                                
                                                {hasWaitlist && (
                                                    <div className="small fw-bold text-warning border-top mt-1 pt-1">
                                                        WAITLIST: {e.waiting_list_count}
                                                    </div>
                                                )}

                                                {hasEmptySeats ? (
                                                    <div className="small fw-bold text-danger">
                                                        Available: {e.empty_seats}
                                                    </div>
                                                ) : !hasWaitlist && (
                                                    <div className="small text-muted italic">100% Capacity</div>
                                                )}
                                            </div>
                                        ) : (
                                            <Badge bg="secondary">Pending</Badge>
                                        )}
                                    </td>
                                    <td>
                                        <Button 
                                            size="sm" 
                                            variant={e.is_allocated ? "outline-warning" : "primary"}
                                            onClick={() => runAllocation(e.id)} 
                                            disabled={loading === e.id}
                                            className="w-100 fw-bold"
                                        >
                                            {loading === e.id ? (
                                                <Spinner size="sm" animation="border" />
                                            ) : (
                                                e.is_allocated ? "Re-Run Trio-Zebra" : "Run Algorithm"
                                            )}
                                        </Button>
                                    </td>
                                    <td>
                                        {e.is_allocated && (
                                            <Button 
                                                size="sm" 
                                                variant="info" 
                                                className="text-white w-100 fw-bold" 
                                                onClick={() => openVisualAudit(e.id)}
                                            >
                                                View Map
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </Table>
            </div>

            {/* Hall Audit Modal: Uses lg-down fullscreen for high visibility on mobile */}
            <Modal show={showModal} onHide={() => setShowModal(false)} size="xl" centered fullscreen="lg-down">
                <Modal.Header closeButton className="bg-dark text-white">
                    <Modal.Title className="fs-6 fw-bold">Seating Audit Map & Logic Verification</Modal.Title>
                </Modal.Header>
                <Modal.Body className="bg-light p-0">
                    <HallVisualizer examId={selectedExamId} />
                </Modal.Body>
                <Modal.Footer className="border-top bg-white">
                    <Button variant="secondary" onClick={() => setShowModal(false)} className="px-4 fw-bold">
                        Close Audit
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default AllocationManager;