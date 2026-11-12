import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  Button,
  Table,
  Form,
  Container,
  Row,
  Col,
  Card,
} from "react-bootstrap";
import { CSVLink } from "react-csv";
import { FaRegCopy, FaCheck } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { BASE_URL } from "../utils/config";

/* ---------- helpers ---------- */
const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const currentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  return { start: fmt(start), end: fmt(end) };
};

const MoneyDashboard = () => {
  const navigate = useNavigate();

  const [summary, setSummary] = useState({});
  const [paid, setPaid] = useState([]);
  const [pending, setPending] = useState([]);
  const [tab, setTab] = useState("paid"); // paid | pending
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState("");

  const [filters, setFilters] = useState({
    city: "All Cities",
    service: "All Services",
  });
  const [dateRange, setDateRange] = useState(currentMonthRange());

  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(false);

  // Create Payment Link modal
  const [showModal, setShowModal] = useState(false);
  const [errors, setErrors] = useState({ phone: "" });
  const [formData, setFormData] = useState({
    type: "customer",
    name: "",
    phone: "",
    amount: "",
    service: "",
    city: "",
    context: "others",
  });

  /* ---------- data ---------- */
  const fetchCities = async () => {
    try {
      setCitiesLoading(true);
      const res = await axios.get(`${BASE_URL}/city/city-list`);
      const list = (res.data?.data || res.data || [])
        .map((c) => (typeof c === "string" ? c : c?.city))
        .filter(Boolean);
      setCities(list);
    } catch (e) {
      console.error("fetchCities error:", e);
      setCities([]);
    } finally {
      setCitiesLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.city && filters.city !== "All Cities")
        params.set("city", filters.city);
      if (filters.service && filters.service !== "All Services")
        params.set("service", filters.service);
      if (dateRange.start) params.set("startDate", dateRange.start);
      if (dateRange.end) params.set("endDate", dateRange.end);
      const res = await axios.get(
        `${BASE_URL}/bookings/money-dashboard?${params.toString()}`,
      );
      setSummary(res.data?.summary || {});
      setPaid(Array.isArray(res.data?.paid) ? res.data.paid : []);
      setPending(Array.isArray(res.data?.pending) ? res.data.pending : []);
    } catch (e) {
      console.error("fetchMoneyDashboard error:", e);
      setSummary({});
      setPaid([]);
      setPending([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCities();
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // City / Service filters apply immediately; the Search button applies dates.
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.city, filters.service]);

  const handleSearch = () => fetchData();

  /* ---------- create payment link ---------- */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "phone") {
      if (!/^\d*$/.test(value) || value.length > 10) return;
      setFormData((p) => ({ ...p, phone: value }));
      setErrors((p) => ({
        ...p,
        phone: value.length === 10 ? "" : "Phone must be 10 digits",
      }));
      return;
    }
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const generatePaymentLink = async () => {
    try {
      await axios.post(`${BASE_URL}/manual-payment/`, formData);
      setShowModal(false);
      fetchData();
    } catch (e) {
      console.error("generatePaymentLink error:", e);
      alert("Error creating link");
    }
  };

  /* ---------- copy ---------- */
  const copy = (txt) => {
    try {
      navigator.clipboard?.writeText(String(txt));
      setCopiedId(String(txt));
      setTimeout(() => setCopiedId(""), 1200);
    } catch (e) {
      /* ignore */
    }
  };

  /* ---------- summary tiles ---------- */
  // #3: Amount Unpaid, Coins Sold, Income from Coins, Online Payment and Cash
  // Payment were not working correctly and have been removed. Only Total Sales
  // and Amount Yet to Be Collected remain.
  const tiles = [
    { label: "Total Sales", value: money(summary.totalSales) },
    {
      label: "Amount Yet to Be Collected",
      value: money(summary.amountYetToBeCollected),
    },
  ];

  /* ---------- CSV (Download Excel) ---------- */
  const csv = useMemo(() => {
    if (tab === "paid") {
      const headers = [
        "Invoice Number",
        "Amount",
        "Date & Time",
        "Customer Name",
        "Booking ID",
        "Payment ID",
        "Vendor",
        "Remark",
        "Service",
        "City",
      ];
      const rows = paid.map((r) => [
        r.invoiceNumber || "",
        r.amount,
        fmtDate(r.dateTime),
        r.customerName || "",
        r.bookingId || "",
        r.paymentId || "",
        r.vendor || "",
        r.remark || "",
        r.service || "",
        r.city || "",
      ]);
      return [headers, ...rows];
    }
    // #6a/#6b: the pending list no longer shows Date & Time or Remark columns.
    const headers = [
      "Amount",
      "Customer Name",
      "Booking ID",
      "Vendor",
      "Service",
      "City",
    ];
    const rows = pending.map((r) => [
      r.amount,
      r.customerName || "",
      r.bookingId || "",
      r.vendor || "",
      r.service || "",
      r.city || "",
    ]);
    return [headers, ...rows];
  }, [tab, paid, pending]);

  /* ---------- conditional cell renderers ---------- */
  const BookingIdCell = ({ row }) => {
    // Clickable only for real bookings (customer / cash / refund) that carry a
    // Mongo id. Manual payments ("Manual payment") and coins ("Coins") are
    // plain text per spec.
    if (row.bookingMongoId) {
      return (
        <span
          role="button"
          style={{ color: "#0d6efd", cursor: "pointer", textDecoration: "underline" }}
          onClick={() => navigate(`/lead-details/${row.bookingMongoId}`)}
        >
          {row.bookingId}
        </span>
      );
    }
    return <span>{row.bookingId}</span>;
  };

  const PaymentIdCell = ({ row }) => {
    // Refund -> "Refund" (no copy); Cash -> "Cash" (no copy); else id + copy.
    if (row.type === "refund") return <span>Refund</span>;
    if (row.type === "cash_payment" || row.paymentId === "Cash")
      return <span>Cash</span>;
    const id = row.paymentId || "—";
    if (!row.paymentId) return <span>{id}</span>;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span>{id}</span>
        <span
          role="button"
          title="Copy"
          style={{ cursor: "pointer", color: "#6c757d" }}
          onClick={() => copy(row.paymentId)}
        >
          {copiedId === row.paymentId ? (
            <FaCheck size={12} color="#28a745" />
          ) : (
            <FaRegCopy size={12} />
          )}
        </span>
      </span>
    );
  };

  const AmountCell = ({ row }) => {
    const neg = Number(row.amount) < 0;
    return (
      <span style={{ color: neg ? "#dc3545" : undefined, fontWeight: 600 }}>
        {neg ? "-" : ""}₹{Math.abs(Number(row.amount || 0)).toLocaleString("en-IN")}
      </span>
    );
  };

  const list = tab === "paid" ? paid : pending;

  return (
    <Container className="mt-4" style={{ fontFamily: "Poppins, sans-serif" }}>
      {/* HEADER + ACTION BAR */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h5 className="fw-bold mb-0">Money Dashboard</h5>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <Form.Select
            size="sm"
            className="w-auto"
            value={filters.city}
            onChange={(e) => setFilters((p) => ({ ...p, city: e.target.value }))}
          >
            <option>All Cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Form.Select>

          <Form.Select
            size="sm"
            className="w-auto"
            value={filters.service}
            onChange={(e) =>
              setFilters((p) => ({ ...p, service: e.target.value }))
            }
          >
            <option>All Services</option>
            <option>House Painting</option>
            <option>Deep Cleaning</option>
          </Form.Select>

          <Form.Control
            size="sm"
            type="date"
            className="w-auto"
            value={dateRange.start}
            onChange={(e) =>
              setDateRange((p) => ({ ...p, start: e.target.value }))
            }
          />
          <span className="text-muted">–</span>
          <Form.Control
            size="sm"
            type="date"
            className="w-auto"
            value={dateRange.end}
            onChange={(e) =>
              setDateRange((p) => ({ ...p, end: e.target.value }))
            }
          />

          <Button size="sm" variant="dark" onClick={handleSearch}>
            Search
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => setShowModal(true)}
          >
            + Create Payment Link
          </Button>
        </div>
      </div>

      {/* SUMMARY TILES */}
      <Row className="g-2 mb-3">
        {tiles.map((t) => (
          <Col xs={6} md={4} lg={3} key={t.label}>
            <Card className="h-100" style={{ border: "1px solid #eee" }}>
              <Card.Body className="py-2 px-3">
                <div style={{ fontSize: 11, color: "#6c757d" }}>{t.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{t.value}</div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* TABLE CONTROLS */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div style={{ display: "flex", gap: 10 }}>
          {["paid", "pending"].map((t) => (
            <div
              key={t}
              role="button"
              onClick={() => setTab(t)}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                fontSize: 12,
                cursor: "pointer",
                background: tab === t ? "#111" : "#fff",
                color: tab === t ? "#fff" : "#111",
              }}
            >
              {t === "paid" ? "Paid List" : "Pending List"}
            </div>
          ))}
        </div>
        <CSVLink
          data={csv}
          filename={`money-dashboard-${tab}.csv`}
          className="btn btn-sm btn-outline-success"
        >
          Download Excel
        </CSVLink>
      </div>

      {/* TABLE */}
      <div style={{ overflowX: "auto" }}>
        <Table bordered hover size="sm" style={{ fontSize: 12 }}>
          <thead style={{ background: "#f7f7f7" }}>
            {tab === "paid" ? (
              <tr>
                <th>Invoice Number</th>
                <th>Amount</th>
                <th>Date &amp; Time</th>
                <th>Customer Name</th>
                <th>Booking ID</th>
                <th>Payment ID</th>
                <th>Vendor</th>
                <th>Remark</th>
                <th>Service</th>
                <th>City</th>
              </tr>
            ) : (
              // #6a/#6b: pending list drops the Date & Time and Remark columns.
              <tr>
                <th>Amount</th>
                <th>Customer Name</th>
                <th>Booking ID</th>
                <th>Vendor</th>
                <th>Service</th>
                <th>City</th>
              </tr>
            )}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={tab === "paid" ? 10 : 6} className="text-center py-4">
                  Loading…
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={tab === "paid" ? 10 : 6} className="text-center py-4 text-muted">
                  No {tab === "paid" ? "paid" : "pending"} transactions
                </td>
              </tr>
            ) : tab === "paid" ? (
              list.map((r, i) => (
                <tr key={i}>
                  <td>{r.invoiceNumber || "—"}</td>
                  <td><AmountCell row={r} /></td>
                  <td>{fmtDate(r.dateTime)}</td>
                  <td>{r.customerName || "—"}</td>
                  <td><BookingIdCell row={r} /></td>
                  <td><PaymentIdCell row={r} /></td>
                  <td>{r.vendor || "—"}</td>
                  <td>{r.remark || "—"}</td>
                  <td>{r.service || "—"}</td>
                  <td>{r.city || "—"}</td>
                </tr>
              ))
            ) : (
              list.map((r, i) => (
                <tr key={i}>
                  <td><AmountCell row={r} /></td>
                  <td>{r.customerName || "—"}</td>
                  <td><BookingIdCell row={r} /></td>
                  <td>{r.vendor || "—"}</td>
                  <td>{r.service || "—"}</td>
                  <td>{r.city || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      {/* CREATE PAYMENT LINK MODAL */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Create Payment Link</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            {/* #7a: Customer / Vendor radio buttons removed — this form always
                creates a customer payment link (formData.type defaults to
                "customer"). */}
            <Form.Group className="mt-1">
              <Form.Label>Name *</Form.Label>
              <Form.Control name="name" required onChange={handleInputChange} />
            </Form.Group>

            <Form.Group className="mt-3">
              <Form.Label>Phone *</Form.Label>
              <Form.Control
                name="phone"
                value={formData.phone}
                maxLength={10}
                inputMode="numeric"
                required
                style={{ borderColor: errors.phone ? "red" : "" }}
                onChange={handleInputChange}
              />
              {errors.phone && (
                <small style={{ color: "red" }}>{errors.phone}</small>
              )}
            </Form.Group>

            <Form.Group className="mt-3">
              <Form.Label>Amount *</Form.Label>
              <Form.Control
                type="number"
                name="amount"
                required
                onChange={handleInputChange}
              />
            </Form.Group>

            <Form.Group className="mt-3">
              <Form.Label>Service *</Form.Label>
              <Form.Select name="service" required onChange={handleInputChange}>
                <option value="">Select Service</option>
                <option>House Painting</option>
                <option>Deep Cleaning</option>
                <option>Interior</option>
                <option>Packers &amp; Movers</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mt-3">
              <Form.Label>City *</Form.Label>
              <Form.Select name="city" required onChange={handleInputChange}>
                <option value="">Select City</option>
                {citiesLoading ? (
                  <option disabled>Loading cities...</option>
                ) : cities.length === 0 ? (
                  <option disabled>No cities found</option>
                ) : (
                  cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))
                )}
              </Form.Select>
            </Form.Group>

            {/* #7b: Coins / Others context radio buttons removed. */}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="dark" onClick={generatePaymentLink}>
            Generate Payment Link
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default MoneyDashboard;
