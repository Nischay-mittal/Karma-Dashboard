import { useMemo, useState, useEffect } from "react";
import { fetchFootfallByMonth, fetchDivisions, fetchCentres } from "../services/api";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
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

const SPECIALITY_COLORS = [
  "#f59e0b", "#10b981", "#dc2626", "#ec4899", "#eab308", "#8b5cf6",
  "#06b6d4", "#84cc16", "#f43f5e", "#6366f1", "#14b8a6", "#f97316",
];
const getSpecialityColor = (index) => SPECIALITY_COLORS[index % SPECIALITY_COLORS.length];

const METADATA_KEYS = new Set(["date", "total", "total_footfall"]);
const REVENUE_KEYS = new Set(["consultation", "medicine", "otc", "diagnostics", "poc", "eye"]);

function FootfallReport() {
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth());
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedCentre, setSelectedCentre] = useState("");
  const [footfallTarget, setFootfallTarget] = useState("");
  const [recommendedTarget, setRecommendedTarget] = useState(null);
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

  // format date for display and chart axes
  const formatDate = (value) => {
    if (!value) return "";
    const clean = value.split("T")[0];
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

  // Pie chart data - footfall by speciality (doctors names removed/merged)
  const pieChartData = useMemo(() => {
    let bySpec = result?.specialityBreakdown || {};
    let specs = result?.specialities || [];
    let totalFootfall = Object.values(bySpec).reduce((s, v) => s + Number(v || 0), 0) || Number(result?.totalFootfall || 0);

    // Fallback: build from dailyFootfall if API didn't return specialityBreakdown
    const daily = result?.dailyFootfall || [];
    if (Object.keys(bySpec).length === 0 && daily.length > 0) {
      const fallback = {};
      const fallbackSpecs = new Set();
      daily.forEach((row) => {
        Object.keys(row).forEach((k) => {
          if (METADATA_KEYS.has(k) || REVENUE_KEYS.has(k.toLowerCase())) return;
          const v = Number(row[k] ?? 0);
          if (v > 0) {
            fallback[k] = (fallback[k] || 0) + v;
            fallbackSpecs.add(k);
          }
        });
      });
      if (Object.keys(fallback).length > 0) {
        bySpec = fallback;
        specs = Array.from(fallbackSpecs).sort();
        totalFootfall = Object.values(bySpec).reduce((s, v) => s + v, 0) || totalFootfall;
      }
    }

    const specList = (specs.length ? specs : Object.keys(bySpec)).filter((k) => (bySpec[k] || 0) > 0).sort();
    if (totalFootfall === 0) return [];
    if (specList.length === 0) {
      return [{ name: "Total", value: totalFootfall, percentage: "100", color: getSpecialityColor(0) }];
    }

    return specList.map((name, i) => ({
      name,
      value: bySpec[name] || 0,
      percentage: (((bySpec[name] || 0) / totalFootfall) * 100).toFixed(1),
      color: getSpecialityColor(i),
    }));
  }, [result?.specialityBreakdown, result?.specialities, result?.totalFootfall, result?.dailyFootfall]);

  // Get all specialities for bar chart (labels now just speciality)
  const allSpecialities = useMemo(() => {
    const set = new Set();
    [result, comparisonResult.current, comparisonResult.previous].forEach((res) => {
      (res?.specialities || []).forEach((s) => set.add(s));
    });
    let arr = Array.from(set).sort();
    if (arr.length === 0 && (comparisonResult.current || comparisonResult.previous)) arr = ["Total"];
    return arr;
  }, [result?.specialities, comparisonResult.current?.specialities, comparisonResult.previous?.specialities]);

  // Stacked bar chart data - footfall by speciality
  const comparisonBarData = useMemo(() => {
    const curr = comparisonResult.current;
    const prev = comparisonResult.previous;
    const dailyCurr = curr?.dailyFootfall || [];
    const dailyPrev = prev?.dailyFootfall || [];

    const sumBySpec = (rows) => {
      const bySpec = {};
      let totalSum = 0;
      rows.forEach((row) => {
        const keys = Object.keys(row).filter((k) => !METADATA_KEYS.has(k) && !REVENUE_KEYS.has(k.toLowerCase()));
        const rowTotal = Number(row.total_footfall ?? row.total ?? 0);
        totalSum += rowTotal;
        keys.forEach((key) => {
          bySpec[key] = (bySpec[key] || 0) + Number(row[key] ?? 0);
        });
      });
      if (Object.keys(bySpec).length === 0 && totalSum > 0) bySpec.Total = totalSum;
      return bySpec;
    };

    const currBySpec = sumBySpec(dailyCurr);
    const prevBySpec = sumBySpec(dailyPrev);
    const currTotal = Object.values(currBySpec).reduce((s, v) => s + v, 0);
    const prevTotal = Object.values(prevBySpec).reduce((s, v) => s + v, 0);

    const getMonthRangeLabel = (fromStr, toStr) => {
      if (!fromStr || !toStr) return "";
      const fromDate = new Date(fromStr);
      const toDate = new Date(toStr);
      const fromMonth = fromDate.toLocaleDateString("en-GB", { month: "short" });
      const toMonth = toDate.toLocaleDateString("en-GB", { month: "short" });
      const year = fromDate.getFullYear();
      return fromMonth === toMonth ? `${fromMonth} ${year}` : `${fromMonth}-${toMonth} ${year}`;
    };

    const currLabel = getMonthRangeLabel(curr?.from, curr?.to) || "This Year";
    const prevLabel = getMonthRangeLabel(prev?.from, prev?.to) || "Last Year";

    const buildRow = (label, bySpec, total) => {
      const row = { period: label, total };
      allSpecialities.forEach((spec) => {
        const v = bySpec[spec] || 0;
        row[spec] = v;
        row[`${spec}Percent`] = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
      });
      return row;
    };

    return [
      buildRow(currLabel, currBySpec, currTotal),
      buildRow(prevLabel, prevBySpec, prevTotal),
    ];
  }, [comparisonResult.current?.dailyFootfall, comparisonResult.previous?.dailyFootfall, comparisonResult.current?.from, comparisonResult.current?.to, comparisonResult.previous?.from, comparisonResult.previous?.to, allSpecialities]);

  // Detail rows for main month
  const detailRows = useMemo(() => result?.detailRows || [], [result]);

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
    if (!result?.dailyFootfall?.length || !recommendedTarget || !selectedMonth) {
      return null;
    }

    try {
      const target = Number(recommendedTarget);
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
      } else if (result.dailyFootfall.length > 0) {
        const dates = result.dailyFootfall.map(r => new Date(r.date)).filter(d => !isNaN(d.getTime()));
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
      const monthData = result.dailyFootfall
        .filter(r => {
          const date = new Date(r.date);
          return date >= monthStart && date <= monthEnd;
        })
        .map(r => ({
          date: r.date,
          footfall: Number(r.total_footfall ?? r.total ?? 0),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      if (monthData.length === 0) return null;

      // Calculate MTD (Month-To-Date) footfall
      const mtdFootfall = monthData.reduce((sum, r) => sum + r.footfall, 0);

      // Calculate cumulative footfall for regression
      let cumulative = 0;
      const cumulativeDataPoints = [];
      monthData.forEach((r, idx) => {
        cumulative += r.footfall;
        const date = new Date(r.date);
        const dayOfMonth = date.getDate();
        cumulativeDataPoints.push({
          x: dayOfMonth,
          y: cumulative,
        });
      });

      const regression = calculateLinearRegression(cumulativeDataPoints);
      let projectedMonthEnd = mtdFootfall;
      
      if (regression && cumulativeDataPoints.length >= 2) {
        projectedMonthEnd = regression.slope * daysInMonth + regression.intercept;
        projectedMonthEnd = Math.max(mtdFootfall, projectedMonthEnd);
      }

      // Calculate status
      const tolerance = target * 0.02;
      const isOnTrack = Math.abs(projectedMonthEnd - target) <= tolerance || projectedMonthEnd >= target;

      // Calculate required per day (only for ongoing months, excluding Sundays)
      const requiredPerDay = isOngoingMonth && weekdaysRemaining > 0
        ? (target - mtdFootfall) / weekdaysRemaining
        : null;

      // Prepare data for graph
      const graphData = [];
      let runningCumulative = 0;
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(y, m - 1, day);
        const dateStr = date.toISOString().slice(0, 10);
        const actualData = monthData.find(r => r.date.startsWith(dateStr));
        
        if (actualData) {
          runningCumulative += actualData.footfall;
        }
        
        let cumulativeActual = null;
        if (!isOngoingMonth) {
          cumulativeActual = runningCumulative;
        } else {
          if (day <= currentDay) {
            cumulativeActual = runningCumulative;
          }
        }

        const targetValue = (target / daysInMonth) * day;

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
        mtdFootfall,
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
  }, [result, footfallTarget, selectedMonth]);

  const computedTotal = Number(result?.totalFootfall ?? 0) || (result?.dailyFootfall || []).reduce((s, r) => s + Number(r.total_footfall ?? r.total ?? 0), 0);

  const handleApply = async () => {
    setError("");
    setLoading(true);
    setComparisonResult({ current: null, previous: null });
    try {
      const { from, to } = monthToFromTo(selectedMonth);
      const [y, m] = selectedMonth.split("-").map(Number);
      
      const prev3 = lastThreeMonthsRange(selectedMonth);
      const prevYearMonth = `${y - 1}-${String(m).padStart(2, "0")}`;
      const prev3LY = lastThreeMonthsRange(prevYearMonth);

      const divisionName = selectedDivision || undefined;
      const centreId = selectedCentre ? Number(selectedCentre) : undefined;

      console.log("Fetching footfall data:", { from, to, divisionName, centreId });

      // Also fetch previous month and same month last year for recommended target
      const prevMonthDate = new Date(y, m - 2, 1); // previous month
      const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
      const prevMonthRange = monthToFromTo(prevMonthStr);
      const prevYearMonthDate = new Date(prevMonthDate);
      prevYearMonthDate.setFullYear(prevYearMonthDate.getFullYear() - 1);
      const prevYearMonthStr = `${prevYearMonthDate.getFullYear()}-${String(prevYearMonthDate.getMonth() + 1).padStart(2, "0")}`;
      const prevYearMonthRange = monthToFromTo(prevYearMonthStr);

      const [res, resCurr, resPrev, resPrevMonth, resPrevMonthLY] = await Promise.all([
        fetchFootfallByMonth({ from, to, type: "combined", divisionName, centreId, skipDetails: false }),
        fetchFootfallByMonth({ from: prev3.from, to: prev3.to, type: "combined", divisionName, centreId, skipDetails: true }),
        fetchFootfallByMonth({ from: prev3LY.from, to: prev3LY.to, type: "combined", divisionName, centreId, skipDetails: true }),
        fetchFootfallByMonth({ from: prevMonthRange.from, to: prevMonthRange.to, type: "combined", divisionName, centreId, skipDetails: true }),
        fetchFootfallByMonth({ from: prevYearMonthRange.from, to: prevYearMonthRange.to, type: "combined", divisionName, centreId, skipDetails: true }),
      ]);
      
      console.log("Footfall data received:", { 
        main: res?.dailyFootfall?.length || 0, 
        current: resCurr?.dailyFootfall?.length || 0,
        previous: resPrev?.dailyFootfall?.length || 0 
      });
      
      setResult(res);
      setComparisonResult({ current: resCurr, previous: resPrev });

      // Compute recommended target: MAX(50, MAX(prevMonthFootfall, sameMonthLastYear) * 1.1)
      const prevMonthTotal = Number(resPrevMonth?.totalFootfall ?? 0);
      const prevYearMonthTotal = Number(resPrevMonthLY?.totalFootfall ?? 0);
      const base = Math.max(prevMonthTotal, prevYearMonthTotal);
      const computed = Math.round(Math.max(50, base * 1.1));
      setRecommendedTarget(computed);
    } catch (err) {
      console.error("Error fetching footfall:", err);
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

  // All columns from detail query (getFootfallByMonth with skipDetails: false)
  const uniqueCols = [
    "date",
    "date_str",
    "division",
    "center",
    "PatientId",
    "gender",
    "doctor_name",
    "speciality",
    "source",
    "revenue",
    "medicine_revenue",
    "diagnostic_revenue",
    "consultation_revenue",
  ];

  const prepareTableData = (rows) => {
    return rows.map((r) => {
      const obj = {};
      uniqueCols.forEach((col) => {
        if (r[col] != null) obj[col] = r[col];
      });
      return obj;
    });
  };

  const dataTableStyles = {
    table: { style: { backgroundColor: "rgba(15, 23, 42, 0.8)" } },
    headRow: { style: { backgroundColor: "rgba(30, 41, 59, 0.8)", borderBottomColor: "rgba(148, 163, 184, 0.15)" } },
    headCells: { style: { color: "#94a3b8", fontSize: "13px", fontWeight: 600 } },
    cells: { style: { color: "#e5e7eb", fontSize: "14px" } },
    rows: { style: { backgroundColor: "rgba(15, 23, 42, 0.8)", "&:hover": { backgroundColor: "rgba(30, 41, 59, 0.6)" } } },
    pagination: { style: { backgroundColor: "rgba(15, 23, 42, 0.8)", color: "#e5e7eb", borderTopColor: "rgba(148, 163, 184, 0.15)" } },
  };

  const colDisplayName = (col) => {
    if (col === "doctor_name") return "Doctor";
    if (col === "center") return "Centre";
    if (col === "source") return "Source (OTC/Clinic)";
    if (col === "medicine_revenue") return "Medicine Revenue";
    if (col === "diagnostic_revenue") return "Diagnostic Revenue";
    if (col === "consultation_revenue") return "Consultation Revenue";
    return col;
  };

  const createColumns = (cols) =>
    cols.map((col) => ({
      name: colDisplayName(col),
      selector: (row) => row[col],
      sortable: true,
      wrap: true,
      format: (row) => {
        // Keep existing columns/structure but prefer combined label when available
        if (col === "doctor_name") {
          const v = row.doctor_name ?? row.doctorLabel ?? row.doctor_label ?? null;
          if (v == null || v === "") return "";
          return String(v);
        }
        if (col === "speciality") {
          const v = row.speciality ?? row.specialty ?? row.Speciality ?? row.speciality_e ?? null;
          if (v == null || v === "") {
            // Try to derive from doctor_label if available: 'Name - Speciality'
            const lbl = row.doctor_label ?? row.doctorLabel ?? null;
            if (lbl && String(lbl).includes(" - ")) {
              return String(lbl).split(" - ").slice(1).join(" - ");
            }
            return "";
          }
          return String(v);
        }
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
      <h1>Customer Footfall Dashboard</h1>

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
        {/* Recommended target calculated automatically; manual input removed */}
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
              Total footfall ({monthLabel}):{" "}
              <span style={{ color: "#007bff" }}>
                {Number(computedTotal).toLocaleString()}
              </span>
            </p>
          </div>

          <div style={{ display: "flex", gap: "24px", marginBottom: 24, flexWrap: "wrap" }}>
            <div style={{ flex: "1", minWidth: "400px" }}>
              <div style={{ marginBottom: 8 }}>
                <h3 style={{ marginBottom: 4 }}>Footfall breakdown – {monthLabel}</h3>
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
                          `${Number(value).toLocaleString()} visits (${props.payload.percentage}%)`,
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
                      <YAxis
                        tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toLocaleString())}
                        domain={[0, "auto"]}
                        allowDecimals={false}
                      />
                      <Tooltip
                        formatter={(value, name, props) => {
                          const percentKey = `${name}Percent`;
                          const percentage = props.payload[percentKey] || "0";
                          return [`${Number(value).toLocaleString()} visits (${percentage}%)`, name];
                        }}
                        contentStyle={{ borderRadius: 8 }}
                      />
                      <Legend />
                      {allSpecialities.map((spec, idx) => (
                        <Bar
                          key={spec}
                          dataKey={spec}
                          stackId="a"
                          fill={getSpecialityColor(idx)}
                          name={spec}
                          label={(props) => {
                            const { x, y, width, height, payload } = props;
                            if (!payload || width < 20 || height < 15) return null;
                            const value = payload[spec] || 0;
                            const percent = payload[`${spec}Percent`] || "0";
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
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Target vs Performance Section - always visible; Required/Day only for ongoing month */}
          {targetPerformance && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ marginBottom: 8 }}>Target vs Performance - {monthLabel}</h2>
              <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 8 }}>
                Recommended target footfall: <span style={{ color: '#e5e7eb', fontWeight: 700, marginLeft: 8 }}>{recommendedTarget != null ? recommendedTarget.toLocaleString() : '—'}</span>
              </div>
              
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
                    {targetPerformance.target.toLocaleString()}
                  </div>
                </div>
                
                <div style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  padding: "16px",
                  borderRadius: "8px",
                  border: "1px solid rgba(148, 163, 184, 0.15)"
                }}>
                  <div style={{ fontSize: "14px", color: "#94a3b8", marginBottom: "8px" }}>MTD Footfall</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "#e5e7eb" }}>
                    {targetPerformance.mtdFootfall.toLocaleString()}
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
                    {Math.round(targetPerformance.projectedMonthEnd).toLocaleString()}
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
                      {Math.round(targetPerformance.requiredPerDay).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>

              {/* Target vs Performance Graph */}
              <div style={{ marginBottom: 8 }}>
                <h3 style={{ marginBottom: 4 }}>Footfall Trend vs Target</h3>
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
                    <YAxis 
                      tickFormatter={(v) => {
                        if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                        return v.toLocaleString();
                      }}
                      domain={[0, 'auto']}
                      allowDecimals={false}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        const label = name === "actual" ? "Actual Footfall" 
                                     : name === "target" ? "Expected footfall"
                                     : name === "trend" ? "Estimated footfall"
                                     : name;
                        return [`${Number(value).toLocaleString()} visits`, label];
                      }}
                      contentStyle={{ borderRadius: 8 }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      name="Actual Footfall"
                      stroke="#007bff"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="trend"
                      name="Estimated footfall"
                      stroke="#eab308"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={true}
                    />
                    <Line
                      type="monotone"
                      dataKey="target"
                      name="Expected footfall"
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
            <h3 style={{ margin: "12px 0 8px" }}>
              Full data table – {monthLabel} ({detailRows.length} rows)
            </h3>
            <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: 12 }}>
              Query columns: date, division, center, PatientId, gender, doctor_name, speciality, source (OTC/Clinic), revenue, medicine_revenue, diagnostic_revenue, consultation_revenue
            </p>
            <DataTable
              columns={createColumns(uniqueCols)}
              data={filterRows(prepareTableData(detailRows), combinedSearchText)}
              customStyles={dataTableStyles}
              pagination
              paginationPerPage={50}
              paginationRowsPerPageOptions={[25, 50, 100, 250, 500].concat(detailRows.length > 500 ? [detailRows.length] : [])}
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

export default FootfallReport;
