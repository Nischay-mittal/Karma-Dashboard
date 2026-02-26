import { useMemo, useState, useEffect } from "react";
import { fetchRevenue, fetchDivisions, fetchCentres } from "../services/api";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import DataTable from "react-data-table-component";

const defaultMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

// Turn YYYY-MM into from (1st) and to (last day of month)
function monthToFromTo(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

// Last 3 months of the given month (e.g. Dec 2025 → Sep–Nov 2025)
function lastThreeMonthsRange(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const start = new Date(y, m - 4, 1);
  const end = new Date(y, m - 1, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    to: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  };
}

const CATEGORY_COLORS = {
  consultation: "#f59e0b",
  medicine: "#10b981",
  otc: "#dc2626",
  diagnostics: "#ec4899",
  poc: "#eab308",
  eye: "#8b5cf6",
};

function FinanceRevenue() {
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth());
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedCentre, setSelectedCentre] = useState("");
  const [revenueTarget, setRevenueTarget] = useState("");
  const [divisions, setDivisions] = useState([]);
  const [centres, setCentres] = useState([]);
  const [result, setResult] = useState(null);
  const [comparisonResult, setComparisonResult] = useState({ current: null, previous: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [combinedSearchText, setCombinedSearchText] = useState("");

  useEffect(() => {
    fetchDivisions()
      .then((data) => setDivisions(data || []))
      .catch((e) => console.error("Failed to load divisions", e));
  }, []);

  useEffect(() => {
    if (selectedDivision) {
      fetchCentres(selectedDivision)
        .then((data) => setCentres(data || []))
        .catch((e) => console.error("Failed to load centres", e));
    } else {
      setCentres([]);
    }
    setSelectedCentre("");
  }, [selectedDivision]);

  // format date for display and chart axes; strips any time suffix like 18:30:00.000Z
  const formatDate = (value) => {
    if (!value) return "";
    const clean = value.split("T")[0]; // drop time if present
    try {
      return new Date(clean).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return clean;
    }
  };

  // Chart data for chosen month with category breakdown - memoized for performance
  const displayRows = useMemo(() => {
    if (!result?.dailyRevenue?.length) return [];
    const daily = result.dailyRevenue;
    const rows = new Array(daily.length);
    for (let i = 0; i < daily.length; i++) {
      const row = daily[i];
      const rawDate = row.date || row.DATE;
      const total = Number(row.total_revenue ?? row.total ?? 0);
      rows[i] = {
          rawDate,
          date: formatDate(rawDate),
        amount: total,
        Revenue: total,
        Consultation: Number(row.consultation ?? 0),
        Medicine: Number(row.medicine ?? 0),
        OTC: Number(row.otc ?? 0),
        Diagnostics: Number(row.diagnostics ?? 0),
        POC: Number(row.poc ?? 0),
        Eye: Number(row.eye ?? 0),
      };
    }
    return rows.sort((a, b) => a.rawDate.localeCompare(b.rawDate));
  }, [result?.dailyRevenue]);

  // Pie chart data - cumulative revenue percentages for selected month
  const pieChartData = useMemo(() => {
    if (!result?.dailyRevenue?.length) return [];
    
    let totalConsultation = 0;
    let totalMedicine = 0;
    let totalOTC = 0;
    let totalDiagnostics = 0;
    let totalPOC = 0;
    let totalEye = 0;
    
    result.dailyRevenue.forEach((row) => {
      totalConsultation += Number(row.consultation ?? 0);
      totalMedicine += Number(row.medicine ?? 0);
      totalOTC += Number(row.otc ?? 0);
      totalDiagnostics += Number(row.diagnostics ?? 0);
      totalPOC += Number(row.poc ?? 0);
      totalEye += Number(row.eye ?? 0);
    });
    
    const totalRevenue = totalConsultation + totalMedicine + totalOTC + totalDiagnostics + totalPOC + totalEye;
    
    if (totalRevenue === 0) return [];
    
    const data = [
      {
        name: "Consultation",
        value: totalConsultation,
        percentage: ((totalConsultation / totalRevenue) * 100).toFixed(1),
        color: CATEGORY_COLORS.consultation,
      },
      {
        name: "Medicine",
        value: totalMedicine,
        percentage: ((totalMedicine / totalRevenue) * 100).toFixed(1),
        color: CATEGORY_COLORS.medicine,
      },
      {
        name: "OTC",
        value: totalOTC,
        percentage: ((totalOTC / totalRevenue) * 100).toFixed(1),
        color: CATEGORY_COLORS.otc,
      },
      {
        name: "Diagnostics",
        value: totalDiagnostics,
        percentage: ((totalDiagnostics / totalRevenue) * 100).toFixed(1),
        color: CATEGORY_COLORS.diagnostics,
      },
      {
        name: "POC",
        value: totalPOC,
        percentage: ((totalPOC / totalRevenue) * 100).toFixed(1),
        color: CATEGORY_COLORS.poc,
      },
      {
        name: "Eye",
        value: totalEye,
        percentage: ((totalEye / totalRevenue) * 100).toFixed(1),
        color: CATEGORY_COLORS.eye,
      },
    ].filter((item) => item.value > 0); // Only show categories with revenue
    
    return data;
  }, [result?.dailyRevenue]);

  // Stacked bar chart data for last 3 months comparison
  const comparisonBarData = useMemo(() => {
    const curr = comparisonResult.current;
    const prev = comparisonResult.previous;
    const dailyCurr = curr?.dailyRevenue || [];
    const dailyPrev = prev?.dailyRevenue || [];
    
    if (!dailyCurr.length && !dailyPrev.length) return [];
    
    // Calculate cumulative totals for current year 3 months
    let currConsultation = 0, currMedicine = 0, currOTC = 0, currDiagnostics = 0, currPOC = 0, currEye = 0;
    dailyCurr.forEach((row) => {
      currConsultation += Number(row.consultation ?? 0);
      currMedicine += Number(row.medicine ?? 0);
      currOTC += Number(row.otc ?? 0);
      currDiagnostics += Number(row.diagnostics ?? 0);
      currPOC += Number(row.poc ?? 0);
      currEye += Number(row.eye ?? 0);
    });
    const currTotal = currConsultation + currMedicine + currOTC + currDiagnostics + currPOC + currEye;
    
    // Calculate cumulative totals for previous year same 3 months
    let prevConsultation = 0, prevMedicine = 0, prevOTC = 0, prevDiagnostics = 0, prevPOC = 0, prevEye = 0;
    dailyPrev.forEach((row) => {
      prevConsultation += Number(row.consultation ?? 0);
      prevMedicine += Number(row.medicine ?? 0);
      prevOTC += Number(row.otc ?? 0);
      prevDiagnostics += Number(row.diagnostics ?? 0);
      prevPOC += Number(row.poc ?? 0);
      prevEye += Number(row.eye ?? 0);
    });
    const prevTotal = prevConsultation + prevMedicine + prevOTC + prevDiagnostics + prevPOC + prevEye;
    
    // Generate month range labels
    const getMonthRangeLabel = (fromStr, toStr) => {
      if (!fromStr || !toStr) return "";
      const fromDate = new Date(fromStr);
      const toDate = new Date(toStr);
      const fromMonth = fromDate.toLocaleDateString("en-GB", { month: "short" });
      const toMonth = toDate.toLocaleDateString("en-GB", { month: "short" });
      const year = fromDate.getFullYear();
      if (fromMonth === toMonth) {
        return `${fromMonth} ${year}`;
      }
      return `${fromMonth}-${toMonth} ${year}`;
    };
    
    const currLabel = getMonthRangeLabel(curr?.from, curr?.to) || "This Year";
    const prevLabel = getMonthRangeLabel(prev?.from, prev?.to) || "Last Year";
    
    return [
      {
        period: currLabel,
        Consultation: currConsultation,
        Medicine: currMedicine,
        OTC: currOTC,
        Diagnostics: currDiagnostics,
        POC: currPOC,
        Eye: currEye,
        total: currTotal,
        ConsultationPercent: currTotal > 0 ? ((currConsultation / currTotal) * 100).toFixed(1) : "0",
        MedicinePercent: currTotal > 0 ? ((currMedicine / currTotal) * 100).toFixed(1) : "0",
        OTCPercent: currTotal > 0 ? ((currOTC / currTotal) * 100).toFixed(1) : "0",
        DiagnosticsPercent: currTotal > 0 ? ((currDiagnostics / currTotal) * 100).toFixed(1) : "0",
        POCPercent: currTotal > 0 ? ((currPOC / currTotal) * 100).toFixed(1) : "0",
        EyePercent: currTotal > 0 ? ((currEye / currTotal) * 100).toFixed(1) : "0",
      },
      {
        period: prevLabel,
        Consultation: prevConsultation,
        Medicine: prevMedicine,
        OTC: prevOTC,
        Diagnostics: prevDiagnostics,
        POC: prevPOC,
        Eye: prevEye,
        total: prevTotal,
        ConsultationPercent: prevTotal > 0 ? ((prevConsultation / prevTotal) * 100).toFixed(1) : "0",
        MedicinePercent: prevTotal > 0 ? ((prevMedicine / prevTotal) * 100).toFixed(1) : "0",
        OTCPercent: prevTotal > 0 ? ((prevOTC / prevTotal) * 100).toFixed(1) : "0",
        DiagnosticsPercent: prevTotal > 0 ? ((prevDiagnostics / prevTotal) * 100).toFixed(1) : "0",
        POCPercent: prevTotal > 0 ? ((prevPOC / prevTotal) * 100).toFixed(1) : "0",
        EyePercent: prevTotal > 0 ? ((prevEye / prevTotal) * 100).toFixed(1) : "0",
      },
    ];
  }, [comparisonResult.current?.dailyRevenue, comparisonResult.previous?.dailyRevenue, comparisonResult.current?.from, comparisonResult.current?.to, comparisonResult.previous?.from, comparisonResult.previous?.to]);

  // Build 10 points (10-day intervals) for comparison line chart - optimized
  const comparisonLineData = useMemo(() => {
    const curr = comparisonResult.current;
    const prev = comparisonResult.previous;
    const dailyCurr = curr?.dailyRevenue || [];
    const dailyPrev = prev?.dailyRevenue || [];
    if (!dailyCurr.length && !dailyPrev.length) return [];

    const fromStr = curr?.from || prev?.from;
    if (!fromStr) return [];

    const [y, m, d] = fromStr.split("-").map(Number);
    const segments = [];
    const pad = (n) => String(n).padStart(2, "0");
    
    for (let i = 0; i < 10; i++) {
      const segStart = new Date(y, m - 1, d + i * 10);
      const segEnd = new Date(y, segStart.getMonth(), segStart.getDate() + 9);
      const fromSeg = `${segStart.getFullYear()}-${pad(segStart.getMonth() + 1)}-${pad(segStart.getDate())}`;
      const toSeg = `${segEnd.getFullYear()}-${pad(segEnd.getMonth() + 1)}-${pad(segEnd.getDate())}`;
      const label = segStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      segments.push({ label, from: fromSeg, to: toSeg });
    }

    // Pre-build date maps for faster lookup
    const buildDateMap = (dailyList) => {
      const map = new Map();
      for (const r of dailyList) {
        const d = (r.date || r.DATE || "").slice(0, 10);
        if (d) {
          const val = Number(r.total_revenue ?? r.total ?? 0);
          map.set(d, (map.get(d) || 0) + val);
        }
      }
      return map;
    };

    const currMap = buildDateMap(dailyCurr);
    const prevMap = buildDateMap(dailyPrev);

    return segments.map((seg) => {
      const [segY, segM, segD] = seg.from.split("-").map(Number);
      const [segEndY, segEndM, segEndD] = seg.to.split("-").map(Number);
      
      let currSum = 0, prevSum = 0;
      const segStart = new Date(segY, segM - 1, segD);
      const segEnd = new Date(segEndY, segEndM - 1, segEndD);
      const prevStart = new Date(segY - 1, segM - 1, segD);
      const prevEnd = new Date(segEndY - 1, segEndM - 1, segEndD);
      
      for (const [dateStr, val] of currMap) {
        const [dateY, dateM, dateD] = dateStr.split("-").map(Number);
        const checkDate = new Date(dateY, dateM - 1, dateD);
        if (checkDate >= segStart && checkDate <= segEnd) currSum += val;
      }
      
      for (const [dateStr, val] of prevMap) {
        const [dateY, dateM, dateD] = dateStr.split("-").map(Number);
        const checkDate = new Date(dateY, dateM - 1, dateD);
        if (checkDate >= prevStart && checkDate <= prevEnd) prevSum += val;
      }
      
      return { period: seg.label, "This Year": currSum, "Last Year": prevSum };
    });
  }, [comparisonResult.current?.dailyRevenue, comparisonResult.previous?.dailyRevenue]);

  // Detail rows for main month (combined OTC + Patient with source)
  const detailRows = useMemo(() => {
    if (!result) return [];
    const otc = (result.otcRows || []).map((r) => ({ ...r, source: "OTC" }));
    const patient = (result.patientRows || []).map((r) => ({ ...r, source: "Patient" }));
    return [...otc, ...patient];
  }, [result]);

  // Linear regression helper function
  const calculateLinearRegression = (dataPoints) => {
    if (dataPoints.length < 2) return null;
    const n = dataPoints.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    dataPoints.forEach(({ x, y }) => {
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
  };

  // Calculate target vs actual performance metrics
  const targetPerformance = useMemo(() => {
    // Only calculate if we have all required data
    if (!result?.dailyRevenue?.length || !revenueTarget || !selectedMonth) {
      return null;
    }
    
    try {
      const target = Number(revenueTarget);
      if (!target || target <= 0) return null;

      const [y, m] = selectedMonth.split("-").map(Number);
      if (isNaN(y) || isNaN(m)) return null;
      
      const monthStart = new Date(y, m - 1, 1);
      const monthEnd = new Date(y, m, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const isOngoingMonth = today >= monthStart && today <= monthEnd;
      const daysInMonth = monthEnd.getDate();
      let currentDay = daysInMonth;
      if (isOngoingMonth) {
        currentDay = today.getDate();
      } else if (result.dailyRevenue.length > 0) {
        const dates = result.dailyRevenue.map(r => new Date(r.date)).filter(d => !isNaN(d.getTime()));
        if (dates.length > 0) {
          const lastDataDate = new Date(Math.max(...dates));
          currentDay = lastDataDate.getDate();
        }
      }
      const daysRemaining = Math.max(0, daysInMonth - currentDay);
      
      // Count weekdays (excluding Sundays) remaining in the month
      const countWeekdaysRemaining = () => {
        let count = 0;
        for (let day = currentDay + 1; day <= daysInMonth; day++) {
          const date = new Date(y, m - 1, day);
          const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
          if (dayOfWeek !== 0) { // Exclude Sunday
            count++;
          }
        }
        return count;
      };
      const weekdaysRemaining = isOngoingMonth ? countWeekdaysRemaining() : 0;

    // Filter data for selected month only
    const monthData = result.dailyRevenue
      .filter(r => {
        const date = new Date(r.date);
        return date >= monthStart && date <= monthEnd;
      })
      .map(r => ({
        date: r.date,
        revenue: Number(r.total_revenue ?? r.total ?? 0),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (monthData.length === 0) return null;

    // Calculate MTD (Month-To-Date) revenue
    const mtdRevenue = monthData.reduce((sum, r) => sum + r.revenue, 0);

    // Calculate cumulative revenue for regression
    // Use sequential day numbers (1, 2, 3...) based on data order, not day of month
    let cumulative = 0;
    const cumulativeDataPoints = [];
    monthData.forEach((r, idx) => {
      cumulative += r.revenue;
      const date = new Date(r.date);
      const dayOfMonth = date.getDate();
      cumulativeDataPoints.push({
        x: dayOfMonth, // Use actual day of month for regression
        y: cumulative,
      });
    });

    const regression = calculateLinearRegression(cumulativeDataPoints);
    let projectedMonthEnd = mtdRevenue;
    
    if (regression && cumulativeDataPoints.length >= 2) {
      // Project to end of month using linear regression
      projectedMonthEnd = regression.slope * daysInMonth + regression.intercept;
      projectedMonthEnd = Math.max(mtdRevenue, projectedMonthEnd); // Don't project below current
    }

    // Calculate status
    const tolerance = target * 0.02; // 2% tolerance
    const isOnTrack = Math.abs(projectedMonthEnd - target) <= tolerance || projectedMonthEnd >= target;

    // Calculate required per day (only for ongoing months, excluding Sundays)
    const requiredPerDay = isOngoingMonth && weekdaysRemaining > 0 
      ? (target - mtdRevenue) / weekdaysRemaining 
      : null;

    // Prepare data for graph
    const graphData = [];
    let runningCumulative = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(y, m - 1, day);
      const dateStr = date.toISOString().slice(0, 10);
      const actualData = monthData.find(r => r.date.startsWith(dateStr));
      
      // Add to cumulative if we have data for this day
      if (actualData) {
        runningCumulative += actualData.revenue;
      }
      
      // For ongoing months, only show actual data up to today
      // For past months, show all actual data
      let cumulativeActual = null;
      if (!isOngoingMonth) {
        // Past month: show cumulative up to this day
        cumulativeActual = runningCumulative;
      } else {
        // Ongoing month: only show if day <= current day
        if (day <= currentDay) {
          cumulativeActual = runningCumulative;
        }
      }

      // Target line (straight line from 0 to target) - always show
      const targetValue = (target / daysInMonth) * day;

      // Trend line (linear regression projection) - always show
      let trendValue = null;
      if (regression && cumulativeDataPoints.length >= 2) {
        trendValue = regression.slope * day + regression.intercept;
        trendValue = Math.max(0, trendValue);
      }

      graphData.push({
        day,
        date: date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        actual: cumulativeActual,
        target: targetValue,
        trend: trendValue,
      });
    }

      return {
        target,
        mtdRevenue,
        projectedMonthEnd,
        isOnTrack,
        requiredPerDay,
        daysRemaining,
        isOngoingMonth,
        graphData,
      };
    } catch (error) {
      console.error("Error calculating target performance:", error);
      return null;
    }
  }, [result, revenueTarget, selectedMonth]);


  const computedTotal = Number(result?.totalRevenue ?? 0) || displayRows.reduce((s, r) => s + r.amount, 0);

  const handleApply = async () => {
    setError("");
    setLoading(true);
    setComparisonResult({ current: null, previous: null });
    try {
      const { from, to } = monthToFromTo(selectedMonth);
      const [y, m] = selectedMonth.split("-").map(Number);
      
      // Last 3 months of selected month (current year)
      // e.g. Dec 2025 → Sep-Nov 2025
      const prev3 = lastThreeMonthsRange(selectedMonth);
      
      // Same 3 months, previous year
      // e.g. Dec 2025 → Sep-Nov 2024
      const prevYearMonth = `${y - 1}-${String(m).padStart(2, "0")}`;
      const prev3LY = lastThreeMonthsRange(prevYearMonth);
      

      const divisionName = selectedDivision || undefined;
      const centreId = selectedCentre ? Number(selectedCentre) : undefined;

      console.log("Fetching revenue data:", { from, to, divisionName, centreId });

      // Main month: get full data with details
      // Comparison months: skip details (only need dailyRevenue for charts)
      const [res, resCurr, resPrev] = await Promise.all([
        fetchRevenue({ from, to, type: "combined", divisionName, centreId, skipDetails: false }),
        fetchRevenue({ from: prev3.from, to: prev3.to, type: "combined", divisionName, centreId, skipDetails: true }),
        fetchRevenue({ from: prev3LY.from, to: prev3LY.to, type: "combined", divisionName, centreId, skipDetails: true }),
      ]);
      
      console.log("Revenue data received:", { 
        main: res?.dailyRevenue?.length || 0, 
        current: resCurr?.dailyRevenue?.length || 0,
        previous: resPrev?.dailyRevenue?.length || 0 
      });
      
      setResult(res);
      setComparisonResult({ current: resCurr, previous: resPrev });
    } catch (err) {
      console.error("Error fetching revenue:", err);
      setError(err?.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const monthLabel = useMemo(() => {
    if (!selectedMonth) return "";
    const [y, m] = selectedMonth.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString("en-GB", {
      month: "long",
      year: "numeric",
    });
  }, [selectedMonth]);

  const uniqueCols = [
    "PatientId",
    "HistoryId",
    "OtcId",
    "DATE",
    "Village",
    "COST",
    "Cost",
    "PaidAmount",
    "Medicine",
    "MedicineKP",
    "ManualFees",
    "Adjustment",
    "Doctor",
    "Others",
    "TestKP",
    "Discount",
    "NonPayment",
    "reconcilemedicine",
    "Name",
    "source",
  ];

  const formatDateCol = (value) => {
    if (!value) return "";
    const clean = String(value).split("T")[0];
    try {
      return new Date(clean).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return clean;
    }
  };

  const prepareTableData = (rows) => {
    return rows.map((row) => {
      const out = {};
      uniqueCols.forEach((col) => {
        const v = row[col];
        if (v == null) out[col] = "";
        else if (col === "DATE" || col.toLowerCase().includes("date")) out[col] = formatDateCol(v);
        else if (typeof v === "number" || (typeof v === "string" && !Number.isNaN(Number(v)))) out[col] = v;
        else out[col] = String(v);
      });
      return out;
    });
  };

  const dataTableStyles = {
    table: { style: { backgroundColor: "rgba(15, 23, 42, 0.8)", borderRadius: "12px" } },
    headRow: { style: { backgroundColor: "rgba(30, 41, 59, 0.8)", borderBottomWidth: "1px", borderBottomColor: "rgba(148, 163, 184, 0.15)" } },
    headCells: { style: { fontSize: "13px", color: "#94a3b8", fontWeight: 600, paddingLeft: "18px", paddingRight: "18px" } },
    cells: { style: { fontSize: "14px", color: "#e5e7eb", paddingLeft: "18px", paddingRight: "18px" } },
    rows: { style: { backgroundColor: "rgba(15, 23, 42, 0.8)", borderBottomColor: "rgba(148, 163, 184, 0.15)", "&:hover": { backgroundColor: "rgba(30, 41, 59, 0.6)" } } },
    pagination: { style: { backgroundColor: "rgba(15, 23, 42, 0.8)", color: "#e5e7eb", borderTopColor: "rgba(148, 163, 184, 0.15)" } },
  };

  const colDisplayName = (col) => {
    if (col === "Name") return "Division";
    if (col === "Village") return "Centre";
    return col;
  };

  const createColumns = (cols) =>
    cols.map((col) => ({
      name: colDisplayName(col),
      selector: (row) => row[col],
      sortable: true,
      wrap: true,
      format: (row) => {
        const v = row[col];
        if (v == null || v === "") return "";
        if (typeof v === "number" && !Number.isNaN(v)) return v.toLocaleString();
        return String(v);
      },
    }));

  const filterRows = (rows, search) => {
    if (!search) return rows;
    const lower = search.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some((v) => String(v).toLowerCase().includes(lower))
    );
  };

  return (
    <div className="app">
      <h1>Finance Revenue Dashboard</h1>

      <div className="filters">
        <div>
          <label>Division</label>
          <select
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            style={{ minWidth: 180 }}
          >
            <option value="">All Divisions</option>
            {divisions.map((d, idx) => (
              <option key={idx} value={d.Name}>
                {d.Name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Centre</label>
          <select
            value={selectedCentre}
            onChange={(e) => setSelectedCentre(e.target.value)}
            disabled={!selectedDivision}
            style={{ minWidth: 180 }}
          >
            <option value="">All Centres</option>
            {centres.map((c) => (
              <option key={c.ID} value={c.ID}>
                {c.Village}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Select Month</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ minWidth: 160 }}
          />
        </div>
        <div>
          <label>Select Revenue Target (INR)</label>
          <input
            type="number"
            value={revenueTarget}
            onChange={(e) => setRevenueTarget(e.target.value)}
            placeholder="Enter target"
            style={{ minWidth: 160 }}
          />
        </div>
        <div className="buttons">
          <button onClick={handleApply} disabled={loading}>
            {loading ? "Loading..." : "Apply"}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {result && (
        <>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ marginBottom: 4 }}>Summary</h2>
            <p style={{ fontSize: "16px", fontWeight: 500 }}>
              Total revenue ({monthLabel}):{" "}
              <span style={{ color: "#007bff" }}>
                ₹ {Number(computedTotal).toLocaleString()}
              </span>
            </p>
          </div>

          <div style={{ display: "flex", gap: "24px", marginBottom: 24, flexWrap: "wrap" }}>
            <div style={{ flex: "1", minWidth: "400px" }}>
              <div style={{ marginBottom: 8 }}>
                <h3 style={{ marginBottom: 4 }}>Revenue breakdown – {monthLabel}</h3>
              </div>
              <div style={{ height: 400, width: "100%" }}>
                {pieChartData.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#94a3b8" }}>
                    No data available for this period
                  </div>
                ) : (
            <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percentage }) => `${name}: ${percentage}%`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                <Tooltip
                        formatter={(value, name, props) => [
                          `₹ ${Number(value).toLocaleString()} (${props.payload.percentage}%)`,
                          props.payload.name,
                        ]}
                        contentStyle={{ borderRadius: 8 }}
                />
                <Legend />
                    </PieChart>
            </ResponsiveContainer>
                )}
              </div>
          </div>

            {comparisonBarData.length > 0 && (
              <div style={{ flex: "1", minWidth: "400px" }}>
                <div style={{ marginBottom: 8 }}>
                  <h3 style={{ marginBottom: 4 }}>
                    Last 3 months vs same period previous year
                  </h3>
                </div>
                <div style={{ height: 400, width: "100%" }}>
                  <ResponsiveContainer>
                    <BarChart data={comparisonBarData}>
                      <CartesianGrid stroke="#e0e0e0" strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value, name, props) => {
                          const percentKey = `${name}Percent`;
                          const percentage = props.payload[percentKey] || "0";
                          return [`₹ ${Number(value).toLocaleString()} (${percentage}%)`, name];
                        }}
                        contentStyle={{ borderRadius: 8 }}
                      />
                      <Legend />
                      <Bar
                        dataKey="Consultation"
                        stackId="a"
                        fill={CATEGORY_COLORS.consultation}
                        name="Consultation"
                        label={(props) => {
                          const { x, y, width, height, payload } = props;
                          if (!payload || width < 20 || height < 15) return null;
                          const value = payload.Consultation || 0;
                          const percent = payload.ConsultationPercent || "0";
                          if (value === 0) return null;
                          return (
                            <text
                              x={x + width / 2}
                              y={y + height / 2}
                              fill="#fff"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize={10}
                              fontWeight="bold"
                            >
                              {percent}%
                            </text>
                          );
                        }}
                      />
                      <Bar
                        dataKey="Medicine"
                        stackId="a"
                        fill={CATEGORY_COLORS.medicine}
                        name="Medicine"
                        label={(props) => {
                          const { x, y, width, height, payload } = props;
                          if (!payload || width < 20 || height < 15) return null;
                          const value = payload.Medicine || 0;
                          const percent = payload.MedicinePercent || "0";
                          if (value === 0) return null;
                          return (
                            <text
                              x={x + width / 2}
                              y={y + height / 2}
                              fill="#fff"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize={10}
                              fontWeight="bold"
                            >
                              {percent}%
                            </text>
                          );
                        }}
                      />
                      <Bar
                        dataKey="OTC"
                        stackId="a"
                        fill={CATEGORY_COLORS.otc}
                        name="OTC"
                        label={(props) => {
                          const { x, y, width, height, payload } = props;
                          if (!payload || width < 20 || height < 15) return null;
                          const value = payload.OTC || 0;
                          const percent = payload.OTCPercent || "0";
                          if (value === 0) return null;
                          return (
                            <text
                              x={x + width / 2}
                              y={y + height / 2}
                              fill="#fff"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize={10}
                              fontWeight="bold"
                            >
                              {percent}%
                            </text>
                          );
                        }}
                      />
                      <Bar
                        dataKey="Diagnostics"
                        stackId="a"
                        fill={CATEGORY_COLORS.diagnostics}
                        name="Diagnostics"
                        label={(props) => {
                          const { x, y, width, height, payload } = props;
                          if (!payload || width < 20 || height < 15) return null;
                          const value = payload.Diagnostics || 0;
                          const percent = payload.DiagnosticsPercent || "0";
                          if (value === 0) return null;
                          return (
                            <text
                              x={x + width / 2}
                              y={y + height / 2}
                              fill="#fff"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize={10}
                              fontWeight="bold"
                            >
                              {percent}%
                            </text>
                          );
                        }}
                      />
                      <Bar
                        dataKey="POC"
                        stackId="a"
                        fill={CATEGORY_COLORS.poc}
                        name="POC"
                        label={(props) => {
                          const { x, y, width, height, payload } = props;
                          if (!payload || width < 20 || height < 15) return null;
                          const value = payload.POC || 0;
                          const percent = payload.POCPercent || "0";
                          if (value === 0) return null;
                          return (
                            <text
                              x={x + width / 2}
                              y={y + height / 2}
                              fill="#fff"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize={10}
                              fontWeight="bold"
                            >
                              {percent}%
                            </text>
                          );
                        }}
                      />
                      <Bar
                        dataKey="Eye"
                        stackId="a"
                        fill={CATEGORY_COLORS.eye}
                        name="Eye-care"
                        label={(props) => {
                          const { x, y, width, height, payload } = props;
                          if (!payload || width < 20 || height < 15) return null;
                          const value = payload.Eye || 0;
                          const percent = payload.EyePercent || "0";
                          if (value === 0) return null;
                          return (
                            <text
                              x={x + width / 2}
                              y={y + height / 2}
                              fill="#fff"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize={10}
                              fontWeight="bold"
                            >
                              {percent}%
                            </text>
                          );
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
            </div>
              </div>
            )}
          </div>

          {/* Target vs Performance Section */}
          {targetPerformance && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ marginBottom: 16 }}>Target vs Performance - {monthLabel}</h2>
              
              {/* KPI Cards */}
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
                gap: "16px", 
                marginBottom: "24px" 
              }}>
                <div style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  padding: "16px",
                  borderRadius: "8px",
                  border: "1px solid rgba(148, 163, 184, 0.15)"
                }}>
                  <div style={{ fontSize: "14px", color: "#94a3b8", marginBottom: "8px" }}>Target</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "#e5e7eb" }}>
                    ₹{targetPerformance.target.toLocaleString()}
                  </div>
                </div>
                
                <div style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  padding: "16px",
                  borderRadius: "8px",
                  border: "1px solid rgba(148, 163, 184, 0.15)"
                }}>
                  <div style={{ fontSize: "14px", color: "#94a3b8", marginBottom: "8px" }}>MTD Revenue</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "#e5e7eb" }}>
                    ₹{targetPerformance.mtdRevenue.toLocaleString()}
                  </div>
                </div>
                
                <div style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  padding: "16px",
                  borderRadius: "8px",
                  border: "1px solid rgba(148, 163, 184, 0.15)"
                }}>
                  <div style={{ fontSize: "14px", color: "#94a3b8", marginBottom: "8px" }}>Projected Month-End</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "#e5e7eb" }}>
                    ₹{Math.round(targetPerformance.projectedMonthEnd).toLocaleString()}
                  </div>
                </div>
                
                <div style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  padding: "16px",
                  borderRadius: "8px",
                  border: `1px solid ${targetPerformance.isOnTrack ? "rgba(34, 197, 94, 0.5)" : "rgba(239, 68, 68, 0.5)"}`
                }}>
                  <div style={{ fontSize: "14px", color: "#94a3b8", marginBottom: "8px" }}>Status</div>
                  <div style={{ 
                    fontSize: "24px", 
                    fontWeight: "bold", 
                    color: targetPerformance.isOnTrack ? "#22c55e" : "#ef4444" 
                  }}>
                    {targetPerformance.isOnTrack ? "On Track" : "Not On Track"}
                  </div>
                </div>
                
                {targetPerformance.requiredPerDay !== null && (
                  <div style={{
                    background: "rgba(15, 23, 42, 0.8)",
                    padding: "16px",
                    borderRadius: "8px",
                    border: "1px solid rgba(148, 163, 184, 0.15)"
                  }}>
                    <div style={{ fontSize: "14px", color: "#94a3b8", marginBottom: "8px" }}>Required / Day</div>
                    <div style={{ fontSize: "24px", fontWeight: "bold", color: "#e5e7eb" }}>
                      ₹{Math.round(targetPerformance.requiredPerDay).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>

              {/* Target vs Performance Graph */}
              <div style={{ marginBottom: 8 }}>
                <h3 style={{ marginBottom: 4 }}>Revenue Trend vs Target</h3>
              </div>
              <div style={{ height: 400, width: "100%", marginBottom: 24 }}>
                <ResponsiveContainer>
                  <LineChart data={targetPerformance.graphData}>
                    <CartesianGrid stroke="#e0e0e0" strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value, name) => {
                        const label = name === "actual" ? "Actual Revenue" 
                                     : name === "target" ? "Expected revenue"
                                     : name === "trend" ? "Estimated revenue"
                                     : name;
                        return [`₹ ${Number(value).toLocaleString()}`, label];
                      }}
                      contentStyle={{ borderRadius: 8 }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      name="Actual Revenue"
                      stroke="#007bff"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="trend"
                      name="Estimated revenue"
                      stroke="#eab308"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={true}
                    />
                    <Line
                      type="monotone"
                      dataKey="target"
                      name="Expected revenue"
                      stroke="#dc2626"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
            </div>
            </div>
          )}

            <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "12px 0 8px" }}>Selected month – detail (Division, Centre, etc.)</h3>
              <DataTable
              columns={createColumns(uniqueCols)}
              data={filterRows(prepareTableData(detailRows), combinedSearchText)}
              customStyles={dataTableStyles}
                pagination
                paginationPerPage={10}
                paginationRowsPerPageOptions={[10, 25, 50, 100]}
                highlightOnHover
                pointerOnHover
                noDataComponent="No data available."
                theme="dark"
                subHeader
                subHeaderComponent={
                  <input
                    type="text"
                  placeholder="Search..."
                  value={combinedSearchText}
                  onChange={(e) => setCombinedSearchText(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #1e293b",
                      background: "#020617",
                      color: "#e5e7eb",
                      marginBottom: "10px",
                      width: "300px",
                    }}
                  />
                }
              />
            </div>
        </>
      )}
    </div>
  );
}

export default FinanceRevenue;

