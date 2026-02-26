const pool = require("../config/db");
const ExcelJS = require("exceljs");

exports.getDivisions = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT Name FROM division ORDER BY Name'
    );
    res.json(rows);
  } catch (err) {
    console.error('DIVISIONS ERROR:', err);
    res.status(500).json({ message: 'Database error', error: err.message });
  }
};

exports.getCentres = async (req, res) => {
  try {
    const { divisionName } = req.query;
    let query = `
      SELECT chw.ID, chw.Village 
      FROM chw 
      JOIN division ON division.Id = chw.DivisionId 
      WHERE 1=1
    `;
    const params = [];
    if (divisionName) {
      query += ' AND division.Name = ?';
      params.push(divisionName);
    }
    query += ' ORDER BY chw.Village';
    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error('CENTRES ERROR:', err);
    res.status(500).json({ message: 'Database error', error: err.message });
  }
};

const toNumber = (val) => {
  if (val == null) return 0;
  const n = typeof val === "string" ? Number(val.replace(/,/g, "")) : Number(val);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Month-based revenue API
 * Accepts { month: "2026-02" }
 * Returns:
 * - dailyRevenue: chosen month with total + category breakdown (Consultation, Medicine, OTC, Diagnostics, POC, Eye)
 * - comparisonData: last 3 months of chosen month vs same 3 months previous year
 */
exports.getRevenueByMonth = async (req, res) => {
  try {
    const { month } = req.body;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: "Invalid month. Use YYYY-MM format." });
    }

    const [year, monthNum] = month.split("-").map(Number);
    const pad = (n) => String(n).padStart(2, "0");
    const fromStr = `${year}-${pad(monthNum)}-01`;
    const lastDay = new Date(year, monthNum, 0).getDate();
    const toStr = `${year}-${pad(monthNum)}-${pad(lastDay)}`;

    // Last 3 months of chosen month: e.g. Dec 2025 -> Sept, Oct, Nov 2025
    const prev3Start = new Date(year, monthNum - 4, 1);
    const prev3End = new Date(year, monthNum - 1, 0);
    const prev3From = `${prev3Start.getFullYear()}-${pad(prev3Start.getMonth() + 1)}-01`;
    const prev3To = `${prev3End.getFullYear()}-${pad(prev3End.getMonth() + 1)}-${pad(prev3End.getDate())}`;

    // Same 3 months previous year
    const prev3StartLY = new Date(year - 1, monthNum - 4, 1);
    const prev3EndLY = new Date(year - 1, monthNum - 1, 0);
    const prev3FromLY = `${prev3StartLY.getFullYear()}-${pad(prev3StartLY.getMonth() + 1)}-01`;
    const prev3ToLY = `${prev3EndLY.getFullYear()}-${pad(prev3EndLY.getMonth() + 1)}-${pad(prev3EndLY.getDate())}`;

    // Get patient and otc data separately and aggregate in JS
    const patientDailyQuery = `
      SELECT
        SUBSTR(patient_history.CreatedDate, 1, 10) AS dt,
        COALESCE(DoctorKP, 0) AS consultation,
        COALESCE(MedicineKP + CorporateKP + MarginKP + MedicineFacilitationKP, 0) AS medicine,
        COALESCE(TestKP, 0) AS diagnostics,
        COALESCE(InjectionKP + DripKP + NebulizeKP + DressingKP + FacilityKP, 0) AS poc
      FROM patient_history
      LEFT JOIN prescription_pricing ON prescription_pricing.HistoryId = patient_history.HistoryId
      LEFT JOIN patient ON patient.PatientId = patient_history.PatientId
      JOIN chw ON chw.ID = patient.Centre
      JOIN division ON division.Id = chw.DivisionId
      WHERE patient_history.CreatedDate BETWEEN ? AND ?
        AND division.Id != 5
    `;

    const otcDailyQuery = `
      SELECT
        SUBSTR(otc_history.CreatedDate, 1, 10) AS dt,
        COALESCE(a.MedicineKP, 0) AS medicine,
        COALESCE(otc_history.PaidAmount, otc_history.Cost, 0) AS otc_total,
        COALESCE(d.TestKP, 0) AS diagnostics,
        COALESCE(otc_history.Injection, 0) AS poc
      FROM otc_history
      LEFT JOIN (SELECT OtcId, SUM(Cost) AS MedicineKP FROM prescription GROUP BY OtcId) a ON a.OtcId = otc_history.OtcId
      LEFT JOIN (SELECT OtcId, SUM(Cost) AS TestKP FROM diagnostic GROUP BY OtcId) d ON d.OtcId = otc_history.OtcId
      JOIN patient ON patient.PatientId = otc_history.PatientId
      JOIN chw ON chw.ID = patient.Centre
      JOIN division ON division.Id = chw.DivisionId
      WHERE otc_history.CreatedDate BETWEEN ? AND ?
    `;

    const [patientRows] = await pool.execute(patientDailyQuery, [fromStr, toStr]);
    const [otcRows] = await pool.execute(otcDailyQuery, [fromStr, toStr]);

    const dailyByDate = {};
    patientRows.forEach((r) => {
      const dt = r.dt;
      if (!dailyByDate[dt]) {
        dailyByDate[dt] = {
          date: dt,
          total: 0,
          consultation: 0,
          medicine: 0,
          otc: 0,
          diagnostics: 0,
          poc: 0,
          eye: 0,
        };
      }
      dailyByDate[dt].consultation += toNumber(r.consultation);
      dailyByDate[dt].medicine += toNumber(r.medicine);
      dailyByDate[dt].diagnostics += toNumber(r.diagnostics);
      dailyByDate[dt].poc += toNumber(r.poc);
      dailyByDate[dt].total +=
        toNumber(r.consultation) + toNumber(r.medicine) + toNumber(r.diagnostics) + toNumber(r.poc);
    });

    otcRows.forEach((r) => {
      const dt = r.dt;
      if (!dailyByDate[dt]) {
        dailyByDate[dt] = {
          date: dt,
          total: 0,
          consultation: 0,
          medicine: 0,
          otc: 0,
          diagnostics: 0,
          poc: 0,
          eye: 0,
        };
      }
      const med = toNumber(r.medicine);
      const otcTotal = toNumber(r.otc_total);
      const diag = toNumber(r.diagnostics);
      const pocVal = toNumber(r.poc);
      const otcRemainder = Math.max(0, otcTotal - med - diag - pocVal);
      dailyByDate[dt].medicine += med;
      dailyByDate[dt].otc += otcRemainder;
      dailyByDate[dt].diagnostics += diag;
      dailyByDate[dt].poc += pocVal;
      dailyByDate[dt].total += med + otcRemainder + diag + pocVal;
    });

    const dailyRevenue = Object.values(dailyByDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({ ...r, total_revenue: r.total }));

    const [currRows] = await pool.execute(
      `SELECT SUBSTR(dt, 1, 7) AS month_key, SUM(total) AS revenue FROM (
        SELECT SUBSTR(patient_history.CreatedDate, 1, 10) AS dt, COALESCE(COST, 0) AS total
        FROM patient_history LEFT JOIN patient ON patient.PatientId = patient_history.PatientId
        JOIN chw ON chw.ID = patient.Centre JOIN division ON division.Id = chw.DivisionId
        WHERE patient_history.CreatedDate BETWEEN ? AND ? AND division.Id != 5
        UNION ALL
        SELECT SUBSTR(otc_history.CreatedDate, 1, 10) AS dt, COALESCE(PaidAmount, Cost, 0) AS total
        FROM otc_history JOIN patient ON patient.PatientId = otc_history.PatientId
        JOIN chw ON chw.ID = patient.Centre JOIN division ON division.Id = chw.DivisionId
        WHERE otc_history.CreatedDate BETWEEN ? AND ?
      ) t GROUP BY SUBSTR(dt, 1, 7) ORDER BY month_key`,
      [prev3From, prev3To, prev3From, prev3To]
    );

    const [prevRows] = await pool.execute(
      `SELECT SUBSTR(dt, 1, 7) AS month_key, SUM(total) AS revenue FROM (
        SELECT SUBSTR(patient_history.CreatedDate, 1, 10) AS dt, COALESCE(COST, 0) AS total
        FROM patient_history LEFT JOIN patient ON patient.PatientId = patient_history.PatientId
        JOIN chw ON chw.ID = patient.Centre JOIN division ON division.Id = chw.DivisionId
        WHERE patient_history.CreatedDate BETWEEN ? AND ? AND division.Id != 5
        UNION ALL
        SELECT SUBSTR(otc_history.CreatedDate, 1, 10) AS dt, COALESCE(PaidAmount, Cost, 0) AS total
        FROM otc_history JOIN patient ON patient.PatientId = otc_history.PatientId
        JOIN chw ON chw.ID = patient.Centre JOIN division ON division.Id = chw.DivisionId
        WHERE otc_history.CreatedDate BETWEEN ? AND ?
      ) t GROUP BY SUBSTR(dt, 1, 7) ORDER BY month_key`,
      [prev3FromLY, prev3ToLY, prev3FromLY, prev3ToLY]
    );

    const monthNames = (m) => {
      const [y, mn] = m.split("-").map(Number);
      return new Date(y, mn - 1, 1).toLocaleString("en-GB", { month: "short", year: "numeric" });
    };

    const comparisonData = {
      currentYear: currRows.map((r) => ({
        month: r.month_key,
        monthLabel: monthNames(r.month_key),
        revenue: toNumber(r.revenue),
      })),
      previousYear: prevRows.map((r) => ({
        month: r.month_key,
        monthLabel: monthNames(r.month_key),
        revenue: toNumber(r.revenue),
      })),
    };

    return res.json({
      month,
      from: fromStr,
      to: toStr,
      dailyRevenue,
      comparisonData,
      totalRevenue: dailyRevenue.reduce((s, r) => s + r.total, 0),
    });
  } catch (err) {
    console.error("REVENUE BY MONTH ERROR:", err);
    res.status(500).json({ message: "Database error", error: err.message });
  }
};

exports.getRevenue = async (req, res) => {
  try {
    console.log('HIT /api/revenue');
    console.log('BODY:', req.body);

    const { from, to, type, divisionName, centreId, skipDetails } = req.body;
    console.log('Parsed params:', { from, to, type, divisionName, centreId, skipDetails });

    if (!from || !to || !type) {
      return res.status(400).json({ message: 'Missing parameters' });
    }

    let otcData = [];
    let patientData = [];

    const toNumber = (val) => {
      if (val == null) return 0;
      const n = typeof val === "string" ? Number(val.replace(/,/g, "")) : Number(val);
      return Number.isFinite(n) ? n : 0;
    };

    /* =======================
       OTC REVENUE
    ======================== */
    if (type === 'otc' || type === 'combined') {
      // Optimized: Use EXISTS for subqueries when skipDetails is true
      let otcQuery = skipDetails ? `
        SELECT
          SUBSTR(otc_history.CreatedDate, 1, 10) AS DATE,
          COALESCE(a.MedicineKP, 0) AS MedicineKP,
          COALESCE(otc_history.PaidAmount, otc_history.Cost, 0) AS PaidAmount,
          COALESCE(otc_history.Cost, 0) AS Cost,
          COALESCE(otc_history.Injection, 0) AS Others,
          COALESCE(d.TestKP, 0) AS TestKP
        FROM otc_history
        LEFT JOIN (
          SELECT OtcId, SUM(Cost) AS MedicineKP FROM prescription GROUP BY OtcId
        ) a ON a.OtcId = otc_history.OtcId
        LEFT JOIN (
          SELECT OtcId, SUM(Cost) AS TestKP FROM diagnostic GROUP BY OtcId
        ) d ON d.OtcId = otc_history.OtcId
        JOIN patient ON patient.PatientId = otc_history.PatientId
        JOIN chw ON chw.ID = patient.Centre
        JOIN division ON division.Id = chw.DivisionId
        WHERE otc_history.CreatedDate BETWEEN ? AND ?
      ` : `
        SELECT
          patient.PatientId,
          otc_history.OtcId,
          SUBSTR(otc_history.CreatedDate, 1, 10) AS DATE,
          chw.Village,
          otc_history.Cost,
          a.MedicineKP,
          otc_history.PaidAmount,
          Injection AS Others,
          Discount,
          NonPayment,
          d.TestKP,
          division.Name
        FROM otc_history
        LEFT JOIN (
          SELECT
            OtcId,
            SUM(Cost) AS MedicineKP,
            SUM(Mrp) AS MedicineMrp,
            SUM(Procurement) AS MedicineProcurement
          FROM prescription
          GROUP BY OtcId
        ) a ON a.OtcId = otc_history.OtcId
        JOIN patient ON patient.PatientId = otc_history.PatientId
        LEFT JOIN (
          SELECT
            OtcId,
            SUM(Mrp) AS TestMRP,
            SUM(KC) AS TestProcurement,
            SUM(Cost) AS TestKP
          FROM diagnostic
          GROUP BY OtcId
        ) d ON d.OtcId = otc_history.OtcId
        JOIN chw ON chw.ID = patient.Centre
        JOIN division ON division.Id = chw.DivisionId
        WHERE otc_history.CreatedDate BETWEEN ? AND ?
      `;
      const otcParams = [from, to];
      if (divisionName && typeof divisionName === 'string' && divisionName.trim() !== '') {
        otcQuery += ' AND division.Name = ?';
        otcParams.push(divisionName);
      }
      if (centreId) {
        otcQuery += ' AND chw.ID = ?';
        otcParams.push(Number(centreId));
      }
      otcQuery += ' ORDER BY otc_history.CreatedDate ASC;';

      console.log('OTC Query:', otcQuery.substring(0, 200) + '...');
      console.log('OTC Params:', otcParams);
      const [rows] = await pool.execute(otcQuery, otcParams);
      otcData = rows;
      console.log(`OTC Query: ${otcData.length} rows returned (skipDetails: ${skipDetails})`);
    }

    /* =======================
       PATIENT REVENUE
       (matches PHP logic)
    ======================== */
    if (type === 'patient' || type === 'combined') {
      let patientQuery = skipDetails ? `
        SELECT
          SUBSTR(patient_history.CreatedDate,1,10) AS DATE,
          COALESCE(patient_history.COST, 0) AS COST,
          COALESCE(DoctorKP, 0) AS Doctor,
          COALESCE(MedicineKP + CorporateKP + MarginKP + MedicineFacilitationKP, 0) AS Medicine,
          COALESCE(TestKP, 0) AS TestKP,
          COALESCE(InjectionKP + DripKP + NebulizeKP + DressingKP + FacilityKP, 0) AS Others
        FROM patient_history
        LEFT JOIN prescription_pricing ON prescription_pricing.HistoryId = patient_history.HistoryId
        LEFT JOIN patient ON patient.PatientId = patient_history.PatientId
        LEFT         JOIN chw ON chw.ID = patient.Centre
        JOIN division ON division.Id = chw.DivisionId
        WHERE patient_history.CreatedDate BETWEEN ? AND ?
      ` : `
        SELECT
          patient_history.PatientId,
          patient_history.HistoryId,
          SUBSTR(patient_history.CreatedDate,1,10) AS DATE,
          chw.Village,
          COST,
          (MedicineKP + CorporateKP + MarginKP + MedicineFacilitationKP) AS Medicine,
          ManualFees,
          Adjustment,
          DoctorKP AS Doctor,
          TestKP,
          InjectionKP + DripKP + NebulizeKP + DressingKP + FacilityKP AS Others,
          reconcilemedicine,
          division.Name
        FROM patient_history
        LEFT JOIN prescription_pricing
          ON prescription_pricing.HistoryId = patient_history.HistoryId
        LEFT JOIN (
          SELECT
            HistoryId,
            ROUND(
              SUM(
                CASE
                  WHEN ReconciledQuantity IS NULL THEN Cost
                  ELSE CAST(ReconciledQuantity*Cost AS DECIMAL)/Quantity
                END
              )
            ) AS reconcilemedicine
          FROM prescription
          GROUP BY HistoryId
        ) b ON b.HistoryId = patient_history.HistoryId
        LEFT JOIN patient ON patient.PatientId = patient_history.PatientId
        LEFT         JOIN chw ON chw.ID = patient.Centre
        JOIN division ON division.Id = chw.DivisionId
        WHERE patient_history.CreatedDate BETWEEN ? AND ?
      `;
      const patientParams = [from, to];
      if (divisionName && typeof divisionName === 'string' && divisionName.trim() !== '') {
        patientQuery += ' AND division.Name = ?';
        patientParams.push(divisionName);
      } else {
        // Always exclude division 5 when no specific division is selected
        patientQuery += ' AND division.Id != 5';
      }
      if (centreId) {
        patientQuery += ' AND chw.ID = ?';
        patientParams.push(Number(centreId));
      }
      patientQuery += ' ORDER BY patient_history.CreatedDate ASC;';

      console.log('Patient Query:', patientQuery.substring(0, 200) + '...');
      console.log('Patient Params:', patientParams);
      const [rows] = await pool.execute(patientQuery, patientParams);
      patientData = rows;
      console.log(`Patient Query: ${patientData.length} rows returned (skipDetails: ${skipDetails})`);
    }

    /* =======================
       BUILD DAILY + TOTAL REVENUE WITH CATEGORY BREAKDOWN
       Categories: Consultation, Medicine, OTC, Diagnostics, POC, Eye
    ======================== */
    const dailyByDate = {};
    let totalRevenue = 0;

    const accumulate = (rows, source) => {
      rows.forEach((r) => {
        const date = r.DATE;
        if (!date) return;
        if (!dailyByDate[date]) {
          dailyByDate[date] = {
            date,
            total: 0,
            consultation: 0,
            medicine: 0,
            otc: 0,
            diagnostics: 0,
            poc: 0,
            eye: 0,
          };
        }
        const day = dailyByDate[date];
        if (source === "otc") {
          const med = toNumber(r.MedicineKP ?? 0);
          const otcTotal = toNumber(r.PaidAmount ?? r.Cost ?? 0);
          const diag = toNumber(r.TestKP ?? 0);
          const pocVal = toNumber(r.Others ?? 0);
          const otcRemainder = Math.max(0, otcTotal - med - diag - pocVal);
          day.medicine += med;
          day.otc += otcRemainder;
          day.diagnostics += diag;
          day.poc += pocVal;
          day.total += otcTotal;
          totalRevenue += otcTotal;
        } else {
          // Patient data
          const consultation = toNumber(r.Doctor ?? 0);
          const medicine = toNumber(r.Medicine ?? 0);
          const diagnostics = toNumber(r.TestKP ?? 0);
          const poc = toNumber(r.Others ?? 0);
          const cost = toNumber(r.COST ?? 0);
          day.consultation += consultation;
          day.medicine += medicine;
          day.diagnostics += diagnostics;
          day.poc += poc;
          day.total += cost;
          totalRevenue += cost;
        }
      });
    };

    if (type === "otc" || type === "combined") {
      accumulate(otcData, "otc");
    }
    if (type === "patient" || type === "combined") {
      accumulate(patientData, "patient");
    }

    const dailyRevenue = Object.values(dailyByDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({
        date: r.date,
        total_revenue: r.total,
        consultation: r.consultation,
        medicine: r.medicine,
        otc: r.otc,
        diagnostics: r.diagnostics,
        poc: r.poc,
        eye: r.eye,
      }));
    
    console.log(`Daily revenue entries: ${dailyRevenue.length}, Total revenue: ${totalRevenue}`);

    const response = {
      type,
      from,
      to,
      totalRevenue,
      dailyRevenue,
    };
    
    // Only include detail rows if not skipped (for comparison queries, we don't need details)
    if (!skipDetails) {
      response.otcRows = otcData;
      response.patientRows = patientData;
    }
    
    return res.json(response);

  } catch (err) {
    console.error('REVENUE ERROR:', err);
    res.status(500).json({ message: 'Database error' });
  }
};

// ...existing code...

exports.downloadRevenueExcel = async (req, res) => {
  try {
    const { from, to, type } = req.body;

    let otcData = [];
    let patientData = [];

    if (type === 'otc' || type === 'combined') {
      const otcQuery = `
        SELECT
          patient.PatientId,
          otc_history.OtcId,
          SUBSTR(otc_history.CreatedDate, 1, 10) AS DATE,
          chw.Village,
          otc_history.Cost,
          a.MedicineKP,
          otc_history.PaidAmount,
          Injection AS Others,
          Discount,
          NonPayment,
          d.TestKP,
          division.Name
        FROM otc_history
        LEFT JOIN (
          SELECT
            OtcId,
            SUM(Cost) AS MedicineKP,
            SUM(Mrp) AS MedicineMrp,
            SUM(Procurement) AS MedicineProcurement
          FROM prescription
          GROUP BY OtcId
        ) a ON a.OtcId = otc_history.OtcId
        JOIN patient ON patient.PatientId = otc_history.PatientId
        LEFT JOIN (
          SELECT
            OtcId,
            SUM(Mrp) AS TestMRP,
            SUM(KC) AS TestProcurement,
            SUM(Cost) AS TestKP
          FROM diagnostic
          GROUP BY OtcId
        ) d ON d.OtcId = otc_history.OtcId
        JOIN chw ON chw.ID = patient.Centre
        JOIN division ON division.Id = chw.DivisionId
        WHERE otc_history.CreatedDate BETWEEN ? AND ?
        ORDER BY otc_history.CreatedDate ASC;
      `;

      const [rows] = await pool.execute(otcQuery, [from, to]);
      otcData = rows;
    }

    if (type === 'patient' || type === 'combined') {
      const patientQuery = `
        SELECT
          patient_history.PatientId,
          patient_history.HistoryId,
          SUBSTR(patient_history.CreatedDate,1,10) AS DATE,
          chw.Village,
          COST,
          (MedicineKP + CorporateKP + MarginKP + MedicineFacilitationKP) AS Medicine,
          ManualFees,
          Adjustment,
          DoctorKP AS Doctor,
          TestKP + InjectionKP + DripKP + NebulizeKP + DressingKP + FacilityKP AS Others,
          reconcilemedicine,
          division.Name
        FROM patient_history
        LEFT JOIN prescription_pricing
          ON prescription_pricing.HistoryId = patient_history.HistoryId
        LEFT JOIN (
          SELECT
            HistoryId,
            ROUND(
              SUM(
                CASE
                  WHEN ReconciledQuantity IS NULL THEN Cost
                  ELSE CAST(ReconciledQuantity*Cost AS DECIMAL)/Quantity
                END
              )
            ) AS reconcilemedicine
          FROM prescription
          GROUP BY HistoryId
        ) b ON b.HistoryId = patient_history.HistoryId
        LEFT JOIN patient ON patient.PatientId = patient_history.PatientId
        LEFT JOIN chw ON chw.ID = patient.Centre
        JOIN division ON division.Id = chw.DivisionId
        WHERE patient_history.CreatedDate BETWEEN ? AND ?
          AND division.Id != 5
        ORDER BY patient_history.CreatedDate ASC;
      `;

      const [rows] = await pool.execute(patientQuery, [from, to]);
      patientData = rows;
    }

    const workbook = new ExcelJS.Workbook();

    // Desired column order (as shown in screenshot)
    const otcHeaders = [
      "PatientId",
      "OtcId",
      "DATE",
      "Village",
      "Cost",
      "MedicineKP",
      "PaidAmount",
      "Others",
      "Discount",
      "NonPayment",
      "TestKP",
      "Name",
    ];

    const patientHeaders = [
      "PatientId",
      "HistoryId",
      "DATE",
      "Village",
      "COST",
      "Medicine",
      "ManualFees",
      "Adjustment",
      "Doctor",
      "Others",
      "reconcilemedicine",
      "Name",
    ];

    // Always create sheets with headers (even if no rows) for consistent format
    const otcSheet = workbook.addWorksheet("otc_history");
    otcSheet.columns = otcHeaders.map((key) => ({ header: key, key }));
    otcData.forEach((row) => {
      const out = {};
      otcHeaders.forEach((k) => (out[k] = row[k] ?? ""));
      otcSheet.addRow(out);
    });

    const patientSheet = workbook.addWorksheet("patient_history");
    patientSheet.columns = patientHeaders.map((key) => ({ header: key, key }));
    patientData.forEach((row) => {
      const out = {};
      patientHeaders.forEach((k) => (out[k] = row[k] ?? ""));
      patientSheet.addRow(out);
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=revenue_${type}_${from}_${to}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("Excel error:", err);
    res.status(500).json({ message: "Excel generation failed" });
  }
};

