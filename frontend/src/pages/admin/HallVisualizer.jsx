import { useState, useEffect } from 'react';
import { Card, Badge, Row, Col, Spinner, ListGroup, Alert, Modal, Button } from 'react-bootstrap';
import api from '../../services/api';

const HallVisualizer = ({ examId, highlightSeatId = null }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // UI state for the interactive features
    const [colorMap, setColorMap] = useState({});
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [showStudentModal, setShowStudentModal] = useState(false);
    const [modalColor, setModalColor] = useState('#0d6efd');

    const PALETTE = [
        '#0d6efd', '#198754', '#6f42c1', '#fd7e14', 
        '#d63384', '#20c997', '#e83e8c', '#6610f2', 
        '#0dcaf0', '#ffc107', '#198754', '#052c65'
    ];

    useEffect(() => {
        if (examId) fetchVisualData();
    }, [examId]);

    const fetchVisualData = async () => {
        try {
            const res = await api.get(`/seating/exams/${examId}/visual-audit/`);
            const fetchedData = res.data;
            
            // Generate a color map for every unique cohort in the room
            const allocations = fetchedData.allocations || [];
            const uniqueCohorts = [...new Set(allocations.map(a => `${a.department}-${a.stage}-${a.subject}`))];
            
            const newColorMap = {};
            uniqueCohorts.forEach((cohort, idx) => {
                newColorMap[cohort] = PALETTE[idx % PALETTE.length];
            });

            setColorMap(newColorMap);
            setData(fetchedData);
        } catch (err) {
            setError('Could not load the hall map.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Helper to format departments as requested: IT, DB, NET
    const getShortDept = (dept) => {
        if (!dept) return "";
        const d = dept.toUpperCase();
        if (d === 'DATABASE') return 'DB';
        if (d === 'NETWORK') return 'NET';
        return d;
    };

    const handleSeatClick = (student, seat, color) => {
        if (student) {
            setSelectedStudent({ 
                ...student, 
                seat_label: `R${seat.row_index + 1}-C${seat.col_index + 1}` 
            });
            setModalColor(color);
            setShowStudentModal(true);
        }
    };

    if (loading) return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;
    if (error) return <Alert variant="danger">{error}</Alert>;
    if (!data) return <Alert variant="info">No seating data available for this session.</Alert>;

    const hasCrossovers = data.crossovers && data.crossovers.length > 0;

    return (
        <Row className="g-4">
            <Col lg={highlightSeatId ? 12 : 9}>
                
                {/* 1. CROSSOVER WARNINGS */}
                {hasCrossovers && !highlightSeatId && (
                    <Alert variant="warning" className="shadow-sm border-warning fw-bold mb-4">
                        ⚠️ CROSSOVER ALERT: These students are taking multiple subjects in this room:
                        <ul className="mb-0 mt-2 fw-normal">
                            {data.crossovers.map((c, i) => (
                                <li key={i}><strong>{c.email}</strong> is taking <em>{c.subjects}</em></li>
                            ))}
                        </ul>
                    </Alert>
                )}

                <Card className="p-2 p-md-3 shadow-sm border-0 bg-white">
                    <div className="text-center w-100 p-2 mb-3 text-muted fw-bold border-bottom bg-light rounded-top" style={{ fontSize: '12px' }}>
                        FRONT / BOARD AREA
                    </div>

                    {/* SCROLLABLE WRAPPER TO PREVENT SCREEN BREAKING */}
                    <div className="overflow-auto pb-2 w-100">
                        <div 
                            style={{ 
                                display: 'grid', 
                                // Scaled down minmax to 45px so cells aren't massive on mobile
                                gridTemplateColumns: `repeat(${data.hall_cols || 5}, minmax(45px, 1fr))`,
                                gap: '6px',
                                justifyContent: 'center',
                                // Forces horizontal scroll instead of squishing if the hall is huge
                                minWidth: 'max-content' 
                            }}
                        >
                            {(data.seats || []).map(seat => {
                                const student = (data.allocations || []).find(a => a.seat_id === seat.id);
                                const isMySeat = highlightSeatId === seat.id;
                                const isSpace = seat.seat_type === 'space';
                                
                                let bgColor = '#ffffff';
                                let textColor = '#6c757d';
                                let cursorStyle = 'default';
                                
                                if (isSpace) {
                                    bgColor = 'transparent';
                                    textColor = 'transparent';
                                } else if (!seat.is_active) {
                                    bgColor = '#e9ecef';
                                } else if (isMySeat) {
                                    bgColor = '#0d6efd';
                                    textColor = '#ffffff';
                                } else if (student) {
                                    // CRITICAL FIX: Prioritize RED for retakes
                                    if (student.is_retake) {
                                        bgColor = '#dc3545';
                                    } else {
                                        const cohortKey = `${student.department}-${student.stage}-${student.subject}`;
                                        bgColor = colorMap[cohortKey] || '#198754';
                                    }
                                    textColor = '#ffffff';
                                    cursorStyle = 'pointer';
                                }

                                return (
                                    <div 
                                        key={seat.id}
                                        onClick={() => !isSpace && handleSeatClick(student, seat, bgColor)}
                                        className={`position-relative d-flex flex-column align-items-center justify-content-center rounded p-1 p-md-2 
                                            ${isMySeat ? 'pulse-highlight' : ''} 
                                            ${student ? 'shadow-sm hover-lift' : ''}`}
                                        style={{ 
                                            minHeight: '55px', // Reduced from 80px
                                            transition: 'all 0.2s',
                                            backgroundColor: bgColor,
                                            color: textColor,
                                            border: isSpace ? 'none' : (isMySeat ? '3px solid #ffd700' : '1px solid #dee2e6'),
                                            cursor: cursorStyle,
                                            visibility: isSpace ? 'hidden' : 'visible'
                                        }}
                                    >
                                        {!isSpace && (
                                            <>
                                                {/* Department Label: Scaled down to 9px for mobile fit */}
                                                <span className="fw-bold mb-0 mb-md-1" style={{ fontSize: '9px', textTransform: 'uppercase' }}>
                                                    {student ? getShortDept(student.department) : `${seat.row_index + 1}-${seat.col_index + 1}`}
                                                </span>
                                                <div className="text-truncate w-100 text-center fw-bold text-uppercase" style={{ fontSize: '11px' }}>
                                                    {student ? student.student_name : !seat.is_active ? 'BROKEN' : 'EMPTY'}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="mt-4 pt-3 border-top d-flex flex-wrap justify-content-center gap-2 small text-muted fw-bold" style={{ fontSize: '11px' }}>
                        {Object.entries(colorMap).map(([cohort, color]) => (
                            <div key={cohort} className="d-flex align-items-center">
                                <div className="rounded me-1 shadow-sm" style={{width: 12, height: 12, backgroundColor: color}}></div> 
                                {cohort.replace(/-/g, ' ')}
                            </div>
                        ))}
                        <div className="d-flex align-items-center"><div className="bg-danger rounded-circle me-1 shadow-sm" style={{width:10, height:10}}></div> Retake</div>
                        <div className="d-flex align-items-center"><div className="bg-white border rounded me-1" style={{width:12, height:12}}></div> Empty</div>
                        <div className="d-flex align-items-center"><div className="bg-light border rounded me-1" style={{width:12, height:12}}></div> Broken</div>
                    </div>
                </Card>
            </Col>

            {/* Waiting List Sidebar */}
            {!highlightSeatId && (
                <Col lg={3}>
                    <h6 className="fw-bold mb-3 d-flex justify-content-between align-items-center">
                        Waiting List
                        <Badge bg="danger" pill>{data.overflow?.length || 0}</Badge>
                    </h6>
                    <ListGroup variant="flush" className="shadow-sm rounded border overflow-auto" style={{ maxHeight: '600px' }}>
                        {data.overflow && data.overflow.length > 0 ? data.overflow.map((student, idx) => (
                                <ListGroup.Item key={idx} className="small py-2 bg-light border-bottom">
                                    <div className="d-flex justify-content-between align-items-start mb-1">
                                        <div className="fw-bold text-truncate">{student.email.split('@')[0]}</div>
                                        {student.is_retake && <Badge bg="danger" style={{fontSize: '9px'}}>RETAKE</Badge>}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: '11px' }}>
                                        {student.department} Stage {student.stage} <br/>
                                        <span className="text-primary fw-bold">{student.subject}</span>
                                    </div>
                                </ListGroup.Item>
                            )) : (
                                <ListGroup.Item className="text-muted small italic p-4 text-center">
                                    All students allocated.
                                </ListGroup.Item>
                            )}
                    </ListGroup>
                </Col>
            )}

            {/* Student Detail Modal */}
            <Modal show={showStudentModal} onHide={() => setShowStudentModal(false)} centered size="sm">
                <Modal.Header closeButton style={{ backgroundColor: modalColor, color: 'white', border: 'none' }}>
                    <Modal.Title className="fs-5 fw-bold">Seat {selectedStudent?.seat_label}</Modal.Title>
                </Modal.Header>
                
                <Modal.Body className="text-center p-4">
                    <div className="fw-bold fs-4 text-uppercase mb-1">{selectedStudent?.student_name}</div>
                    {selectedStudent?.is_retake && (
                        <div className="mb-2">
                            <Badge bg="danger" className="px-3 py-1 shadow-sm">RETAKE STUDENT</Badge>
                        </div>
                    )}
                    <div className="text-muted small mb-4">{selectedStudent?.full_email}</div>
                  
                    <Row className="g-2 text-start">
                        <Col xs={6}>
                            <div className="p-2 bg-light rounded border small h-100">
                                <div className="text-muted" style={{fontSize: '10px'}}>DEPARTMENT</div>
                                <div className="fw-bold text-truncate">{selectedStudent?.department}</div>
                            </div>
                        </Col>
                        <Col xs={6}>
                            <div className="p-2 bg-light rounded border small h-100">
                                <div className="text-muted" style={{fontSize: '10px'}}>STAGE</div>
                                <div className="fw-bold">Stage {selectedStudent?.stage}</div>
                            </div>
                        </Col>
                        <Col xs={12}>
                            <div className="p-2 bg-light rounded border small">
                                <div className="text-muted" style={{fontSize: '10px'}}>EXAM SUBJECT(S)</div>
                                <div className="fw-bold text-primary">{selectedStudent?.subject}</div>
                            </div>
                        </Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer className="border-0 justify-content-center pb-4">
                    <Button variant="outline-secondary" size="sm" onClick={() => setShowStudentModal(false)} className="w-100">
                        Close Details
                    </Button>
                </Modal.Footer>
            </Modal>

            <style>{`
                .pulse-highlight {
                    animation: pulse-blue 2s infinite;
                    box-shadow: 0 0 0 0 rgba(13, 110, 253, 0.7);
                }
                @keyframes pulse-blue {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(13, 110, 253, 0); }
                    100% { transform: scale(1); }
                }
                .hover-lift:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.15) !important;
                }
            `}</style>
        </Row>
    );
};

export default HallVisualizer;