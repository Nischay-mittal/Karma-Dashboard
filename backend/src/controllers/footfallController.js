const pool = require("../config/db");

exports.getFootfall = async (req, res) => {
  try {
    console.log('HIT /api/footfall');
    console.log('BODY:', req.body);

    const { from, to } = req.body;

    if (!from || !to) {
      return res.status(400).json({ message: 'Missing date parameters' });
    }

    // Calculate dates exactly like PHP code:
    // $startDate = date('Y-m-01 00:00:00', strtotime("-1 months"));
    // $endDate = date('Y-m-t 23:59:59', strtotime("-1 months"));
    // $prevMonthStart = date('Y-m-01 00:00:00', strtotime("-2 months"));
    // $prevMonthEnd = date('Y-m-t 23:59:00', strtotime("-2 months"));
    // $prevYearStart = date('Y-m-01 00:00:00', strtotime("-1 year", strtotime($startDate)));
    // $prevYearEnd = date('Y-m-t 23:59:59', strtotime("-1 year", strtotime($startDate)));
    
    const now = new Date();
    
    // Last month (this_Month): -1 months from now
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1, 0, 0, 0);
    const lastMonthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59);
    
    // Previous month: -2 months from now
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const prevMonthStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1, 0, 0, 0);
    const prevMonthEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0, 23, 59, 0);
    
    // Previous year: Same month last year (based on lastMonthStart)
    const prevYearStart = new Date(lastMonthStart);
    prevYearStart.setFullYear(prevYearStart.getFullYear() - 1);
    const prevYearEnd = new Date(lastMonthEnd);
    prevYearEnd.setFullYear(prevYearEnd.getFullYear() - 1);
    
    // Format dates for SQL (YYYY-MM-DD HH:MM:SS)
    const formatDateTime = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };
    
    const startDate = formatDateTime(lastMonthStart); // this_Month start
    const endDate = formatDateTime(lastMonthEnd); // this_Month end
    const prevMonthStartStr = formatDateTime(prevMonthStart);
    const prevMonthEndStr = formatDateTime(prevMonthEnd);
    const prevYearStartStr = formatDateTime(prevYearStart);
    const prevYearEndStr = formatDateTime(prevYearEnd);

    console.log('Date ranges (exact PHP logic):');
    console.log('  this_Month (last month):', startDate, 'to', endDate);
    console.log('  Prev_Month:', prevMonthStartStr, 'to', prevMonthEndStr);
    console.log('  Prev_Year:', prevYearStartStr, 'to', prevYearEndStr);

    // Exact query structure from PHP code
    const footfallQuery = `
      WITH
      -- Get all active centres and divisions
      all_centres AS (
          SELECT DISTINCT
              d.Name    AS Division,
              c.Village AS Centre
          FROM chw AS c
          JOIN division AS d ON c.DivisionId = d.Id
          WHERE c.isEmail = 1
            AND d.isActive = 1
            AND d.IsKarmaDivision = 1
      ),
      
      -- Combined data exactly like PHP query structure
      combined_data AS (
          -- This Month - patient_history
          SELECT 
              division.Name AS Division,
              chw.Village AS Centre,
              COUNT(*) AS Total,
              'this_Month' AS month_name
          FROM patient_history
          LEFT JOIN patient ON patient_history.PatientId = patient.PatientId
          JOIN chw ON chw.ID = patient.Centre
          JOIN division ON chw.DivisionId = division.Id
          WHERE patient_history.CreatedDate BETWEEN ? AND ?
            AND division.IsKarmaDivision = 1
            AND chw.isEmail = 1
            AND division.isActive = 1
            AND patient_history.Status = 'A'
          GROUP BY division.Name, chw.Village
          
          UNION ALL
          
          -- This Month - otc_history
          SELECT 
              division.Name AS Division,
              chw.Village AS Centre,
              COUNT(*) AS Total,
              'this_Month' AS month_name
          FROM otc_history
          LEFT JOIN patient ON otc_history.PatientId = patient.PatientId
          JOIN chw ON chw.ID = patient.Centre
          JOIN division ON chw.DivisionId = division.Id
          WHERE otc_history.CreatedDate BETWEEN ? AND ?
            AND division.IsKarmaDivision = 1
            AND chw.isEmail = 1
            AND division.isActive = 1
          GROUP BY division.Name, chw.Village
          
          UNION ALL
          
          -- Previous Month - patient_history
          SELECT 
              division.Name AS Division,
              chw.Village AS Centre,
              COUNT(*) AS Total,
              'Prev_Month' AS month_name
          FROM patient_history
          LEFT JOIN patient ON patient_history.PatientId = patient.PatientId
          JOIN chw ON chw.ID = patient.Centre
          JOIN division ON chw.DivisionId = division.Id
          WHERE patient_history.CreatedDate BETWEEN ? AND ?
            AND division.IsKarmaDivision = 1
            AND chw.isEmail = 1
            AND division.isActive = 1
            AND patient_history.Status = 'A'
          GROUP BY division.Name, chw.Village
          
          UNION ALL
          
          -- Previous Month - otc_history
          SELECT 
              division.Name AS Division,
              chw.Village AS Centre,
              COUNT(*) AS Total,
              'Prev_Month' AS month_name
          FROM otc_history
          LEFT JOIN patient ON otc_history.PatientId = patient.PatientId
          JOIN chw ON chw.ID = patient.Centre
          JOIN division ON chw.DivisionId = division.Id
          WHERE otc_history.CreatedDate BETWEEN ? AND ?
            AND division.IsKarmaDivision = 1
            AND chw.isEmail = 1
            AND division.isActive = 1
          GROUP BY division.Name, chw.Village
          
          UNION ALL
          
          -- Previous Year - patient_history
          SELECT 
              division.Name AS Division,
              chw.Village AS Centre,
              COUNT(*) AS Total,
              'Prev_Year' AS month_name
          FROM patient_history
          LEFT JOIN patient ON patient_history.PatientId = patient.PatientId
          JOIN chw ON chw.ID = patient.Centre
          JOIN division ON chw.DivisionId = division.Id
          WHERE patient_history.CreatedDate BETWEEN ? AND ?
            AND division.IsKarmaDivision = 1
            AND chw.isEmail = 1
            AND division.isActive = 1
            AND patient_history.Status = 'A'
          GROUP BY division.Name, chw.Village
          
          UNION ALL
          
          -- Previous Year - otc_history
          SELECT 
              division.Name AS Division,
              chw.Village AS Centre,
              COUNT(*) AS Total,
              'Prev_Year' AS month_name
          FROM otc_history
          LEFT JOIN patient ON otc_history.PatientId = patient.PatientId
          JOIN chw ON chw.ID = patient.Centre
          JOIN division ON chw.DivisionId = division.Id
          WHERE otc_history.CreatedDate BETWEEN ? AND ?
            AND division.IsKarmaDivision = 1
            AND chw.isEmail = 1
            AND division.isActive = 1
          GROUP BY division.Name, chw.Village
      ),
      
      -- Group by Division, Centre, month_name (exact PHP structure)
      grouped_data AS (
          SELECT 
              Division,
              Centre,
              SUM(Total) AS Total,
              month_name
          FROM combined_data
          GROUP BY Division, Centre, month_name
      ),
      
      -- Aggregate by period to get this_Month, Prev_Month, Prev_Year
      period_data AS (
          SELECT 
              Division,
              Centre,
              SUM(CASE WHEN month_name = 'this_Month' THEN Total ELSE 0 END) AS this_Month,
              SUM(CASE WHEN month_name = 'Prev_Month' THEN Total ELSE 0 END) AS Prev_Month,
              SUM(CASE WHEN month_name = 'Prev_Year' THEN Total ELSE 0 END) AS Prev_Year
          FROM grouped_data
          GROUP BY Division, Centre
      )
      
      -- Final result with all centres and trend calculations
      SELECT
          ac.Division,
          ac.Centre,
          COALESCE(pd.this_Month, 0) AS Footfall,
          COALESCE(pd.Prev_Month, 0) AS Prev_Month,
          COALESCE(pd.Prev_Year, 0) AS Prev_Year,
          
          -- Trend calculation: ((this_month - prev_month) * 100 / prev_month)
          CASE 
              WHEN COALESCE(pd.Prev_Month, 0) = 0 THEN NULL
              ELSE ROUND(
                  ((COALESCE(pd.this_Month, 0) - pd.Prev_Month) * 100.0 / pd.Prev_Month),
                  2
              )
          END AS Trend_Month_Percent,
          
          -- Trend calculation: ((this_month - prev_year) * 100 / prev_year)
          CASE 
              WHEN COALESCE(pd.Prev_Year, 0) = 0 THEN NULL
              ELSE ROUND(
                  ((COALESCE(pd.this_Month, 0) - pd.Prev_Year) * 100.0 / pd.Prev_Year),
                  2
              )
          END AS Trend_Year_Percent
          
      FROM all_centres ac
      LEFT JOIN period_data pd
             ON ac.Division = pd.Division
            AND ac.Centre   = pd.Centre
      ORDER BY ac.Division, ac.Centre
    `;

    // Query parameters: 6 date ranges (exact order from PHP query)
    const queryParams = [
      startDate, endDate,              // this_Month patient_history
      startDate, endDate,              // this_Month otc_history
      prevMonthStartStr, prevMonthEndStr,  // Prev_Month patient_history
      prevMonthStartStr, prevMonthEndStr,  // Prev_Month otc_history
      prevYearStartStr, prevYearEndStr,     // Prev_Year patient_history
      prevYearStartStr, prevYearEndStr,     // Prev_Year otc_history
    ];

    console.log('Executing footfall query with params:', queryParams);

    const [rows] = await pool.execute(footfallQuery, queryParams);
    
    console.log('Query returned', rows.length, 'rows');
    
    // Debug: Log first few rows to see actual values
    if (rows.length > 0) {
      console.log('Sample row data:', JSON.stringify(rows[0], null, 2));
      console.log('Trend_Month_Percent type:', typeof rows[0].Trend_Month_Percent, 'value:', rows[0].Trend_Month_Percent);
      console.log('Trend_Year_Percent type:', typeof rows[0].Trend_Year_Percent, 'value:', rows[0].Trend_Year_Percent);
    }

    // Process the query results - trends are already calculated in the query
    let rowIndex = 0;
    const processedData = rows.map((row) => {
      const footfall = parseInt(row.Footfall) || 0;
      const prevMonthFootfall = parseInt(row.Prev_Month) || 0;
      const prevYearFootfall = parseInt(row.Prev_Year) || 0;
      
      // Handle NULL values properly - if trend is NULL, it means no previous data exists
      // In that case, we can't calculate a meaningful trend, so we'll set it to null
      const trendMonthPercent = row.Trend_Month_Percent !== null && row.Trend_Month_Percent !== undefined 
        ? parseFloat(row.Trend_Month_Percent) 
        : null;
      const trendYearPercent = row.Trend_Year_Percent !== null && row.Trend_Year_Percent !== undefined 
        ? parseFloat(row.Trend_Year_Percent) 
        : null;

      // Categorize based on trends (using the 4 categories from old system)
      // Concern: Both trends negative
      // Better than last year: Month negative, year positive
      // Better than last month: Month positive, year negative
      // Star: Both positive
      let category = 'All';
      
      // If current footfall is 0, categorize based on whether there was previous data
      if (footfall === 0) {
        if (prevMonthFootfall > 0 || prevYearFootfall > 0) {
          // Had data before but none now - Concerning
          category = 'Concerning';
        } else {
          // No data in any period - keep as All
          category = 'All';
        }
      } else {
        // Current footfall > 0, use normal categorization logic
        if (trendMonthPercent === null && trendYearPercent === null) {
          // No previous data but has current data - can't determine trend
          category = 'All';
        } else if (trendMonthPercent === null) {
          // Only year trend available
          category = trendYearPercent >= 0 ? 'Stars' : 'Concerning';
        } else if (trendYearPercent === null) {
          // Only month trend available
          category = trendMonthPercent >= 0 ? 'Stars' : 'Concerning';
        } else if (trendMonthPercent < 0 && trendYearPercent < 0) {
          // Both negative - Concerning
          category = 'Concerning';
        } else if (trendMonthPercent < 0 && trendYearPercent >= 0) {
          // Month negative, year positive - Better than last year
          category = 'Better than last year';
        } else if (trendMonthPercent >= 0 && trendYearPercent < 0) {
          // Month positive, year negative - Better than last month
          category = 'Better than last month';
        } else if (trendMonthPercent >= 0 && trendYearPercent >= 0) {
          // Both positive - Stars
          category = 'Stars';
        }
      }
      
      // Debug logging for first few rows
      const currentIndex = rowIndex++;
      if (currentIndex < 5) {
        console.log(`Row ${currentIndex} - Centre: ${row.Centre}, Footfall: ${footfall}, PrevMonth: ${prevMonthFootfall}, PrevYear: ${prevYearFootfall}, Month: ${trendMonthPercent}, Year: ${trendYearPercent}, Category: ${category}`);
      }

      return {
        Division: row.Division,
        Centre: row.Centre,
        Footfall: footfall,
        TrendMonth: trendMonthPercent !== null ? trendMonthPercent : 0,
        TrendYear: trendYearPercent !== null ? trendYearPercent : 0,
        TrendMonthStr: trendMonthPercent !== null 
          ? `${trendMonthPercent >= 0 ? '▲' : '▼'} ${Math.abs(trendMonthPercent).toFixed(2)}%`
          : 'N/A',
        TrendYearStr: trendYearPercent !== null 
          ? `${trendYearPercent >= 0 ? '▲' : '▼'} ${Math.abs(trendYearPercent).toFixed(2)}%`
          : 'N/A',
        Category: category,
      };
    });

    console.log('Processed', processedData.length, 'centres');

    // Calculate total summary
    const totalFootfall = processedData.reduce((sum, c) => sum + c.Footfall, 0);
    
    // For summary trends, we need to calculate from the data
    // We'll use a weighted average approach or calculate from totals
    // For now, let's calculate average trends
    const avgTrendMonth = processedData.length > 0
      ? processedData.reduce((sum, c) => sum + c.TrendMonth, 0) / processedData.length
      : 0;
    const avgTrendYear = processedData.length > 0
      ? processedData.reduce((sum, c) => sum + c.TrendYear, 0) / processedData.length
      : 0;

    const trendMonthNum = parseFloat(avgTrendMonth.toFixed(2));
    const trendYearNum = parseFloat(avgTrendYear.toFixed(2));

    // Get daily footfall trend data for line chart
    // Current period: this_Month (last month)
    // Previous period: Prev_Month (previous month)
    const dailyTrendQuery = `
      SELECT DATE, SUM(Total) AS Footfall, period_type
      FROM (
        -- This Month (current) - patient_history
        SELECT 
          DATE(patient_history.CreatedDate) AS DATE,
          COUNT(*) AS Total,
          'current' AS period_type
        FROM patient_history
        LEFT JOIN patient ON patient_history.PatientId = patient.PatientId
        JOIN chw ON chw.ID = patient.Centre
        JOIN division ON chw.DivisionId = division.Id
        WHERE patient_history.CreatedDate BETWEEN ? AND ?
          AND division.IsKarmaDivision = 1
          AND chw.isEmail = 1
          AND division.isActive = 1
          AND patient_history.Status = 'A'
        GROUP BY DATE(patient_history.CreatedDate)

        UNION ALL

        -- This Month (current) - otc_history
        SELECT 
          DATE(otc_history.CreatedDate) AS DATE,
          COUNT(*) AS Total,
          'current' AS period_type
        FROM otc_history
        JOIN patient ON otc_history.PatientId = patient.PatientId
        JOIN chw ON chw.ID = patient.Centre
        JOIN division ON chw.DivisionId = division.Id
        WHERE otc_history.CreatedDate BETWEEN ? AND ?
          AND division.IsKarmaDivision = 1
          AND chw.isEmail = 1
          AND division.isActive = 1
        GROUP BY DATE(otc_history.CreatedDate)

        UNION ALL

        -- Previous Month - patient_history
        SELECT 
          DATE(patient_history.CreatedDate) AS DATE,
          COUNT(*) AS Total,
          'previous' AS period_type
        FROM patient_history
        LEFT JOIN patient ON patient_history.PatientId = patient.PatientId
        JOIN chw ON chw.ID = patient.Centre
        JOIN division ON chw.DivisionId = division.Id
        WHERE patient_history.CreatedDate BETWEEN ? AND ?
          AND division.IsKarmaDivision = 1
          AND chw.isEmail = 1
          AND division.isActive = 1
          AND patient_history.Status = 'A'
        GROUP BY DATE(patient_history.CreatedDate)

        UNION ALL

        -- Previous Month - otc_history
        SELECT 
          DATE(otc_history.CreatedDate) AS DATE,
          COUNT(*) AS Total,
          'previous' AS period_type
        FROM otc_history
        JOIN patient ON otc_history.PatientId = patient.PatientId
        JOIN chw ON chw.ID = patient.Centre
        JOIN division ON chw.DivisionId = division.Id
        WHERE otc_history.CreatedDate BETWEEN ? AND ?
          AND division.IsKarmaDivision = 1
          AND chw.isEmail = 1
          AND division.isActive = 1
        GROUP BY DATE(otc_history.CreatedDate)
      ) AS daily_data
      GROUP BY DATE, period_type
      ORDER BY DATE, period_type
    `;

    const [dailyRows] = await pool.execute(dailyTrendQuery, [
      startDate, endDate,              // current patient (this_Month)
      startDate, endDate,              // current otc (this_Month)
      prevMonthStartStr, prevMonthEndStr,  // previous patient (Prev_Month)
      prevMonthStartStr, prevMonthEndStr,  // previous otc (Prev_Month)
    ]);

    // Transform daily data for chart
    const dailyTrends = {};
    dailyRows.forEach((row) => {
      const dateKey = row.DATE.toISOString().split('T')[0];
      if (!dailyTrends[dateKey]) {
        dailyTrends[dateKey] = { date: dateKey, current: 0, previous: 0 };
      }
      if (row.period_type === 'current') {
        dailyTrends[dateKey].current = parseInt(row.Footfall) || 0;
      } else {
        dailyTrends[dateKey].previous = parseInt(row.Footfall) || 0;
      }
    });

    const dailyTrendData = Object.values(dailyTrends).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    console.log('Summary:', {
      totalFootfall,
      trendMonthNum,
      trendYearNum,
      centreCount: processedData.length,
      dailyTrendCount: dailyTrendData.length
    });

    return res.json({
      from,
      to,
      summary: {
        Footfall: totalFootfall,
        TrendMonth: trendMonthNum,
        TrendYear: trendYearNum,
        TrendMonthStr: `${trendMonthNum >= 0 ? '▲' : '▼'} ${Math.abs(trendMonthNum)}%`,
        TrendYearStr: `${trendYearNum >= 0 ? '▲' : '▼'} ${Math.abs(trendYearNum)}%`,
      },
      centres: processedData.sort((a, b) => {
        // Sort by Division first, then Centre
        if (a.Division !== b.Division) {
          return a.Division.localeCompare(b.Division);
        }
        return a.Centre.localeCompare(b.Centre);
      }),
      dailyTrends: dailyTrendData,
    });

  } catch (err) {
    console.error('FOOTFALL ERROR:', err);
    res.status(500).json({ message: 'Database error', error: err.message });
  }
};

/**
 * Footfall API similar to Revenue API
 * Accepts { from, to, type, divisionName, centreId, skipDetails }
 * Returns daily footfall with category breakdown (only counting visits where OTC > 60)
 */
exports.getFootfallByMonth = async (req, res) => {
  try {
    console.log('HIT /api/footfall/by-month');
    console.log('BODY:', req.body);

    const { from, to, type, divisionName, centreId, skipDetails } = req.body;

    if (!from || !to || !type) {
      return res.status(400).json({ message: 'Missing parameters' });
    }

    let patientData = [];
    let otcData = [];

    /* =======================
       PATIENT FOOTFALL (only count if patient has OTC > 60)
    ======================== */
    if (type === 'patient' || type === 'combined') {
      let patientQuery = skipDetails ? `
        SELECT
          SUBSTR(ph.CreatedDate, 1, 10) AS DATE,
          COUNT(DISTINCT CASE WHEN pp.DoctorKP > 0 THEN ph.HistoryId END) AS consultation,
          COUNT(DISTINCT CASE WHEN pp.MedicineKP + pp.CorporateKP + pp.MarginKP + pp.MedicineFacilitationKP > 0 THEN ph.HistoryId END) AS medicine,
          COUNT(DISTINCT CASE WHEN pp.TestKP > 0 THEN ph.HistoryId END) AS diagnostics,
          COUNT(DISTINCT CASE WHEN pp.InjectionKP + pp.DripKP + pp.NebulizeKP + pp.DressingKP + pp.FacilityKP > 0 THEN ph.HistoryId END) AS poc,
          0 AS otc,
          0 AS eye
        FROM patient_history ph
        LEFT JOIN prescription_pricing pp ON pp.HistoryId = ph.HistoryId
        LEFT JOIN patient ON patient.PatientId = ph.PatientId
        LEFT JOIN chw ON chw.ID = patient.Centre
        JOIN division ON division.Id = chw.DivisionId
        WHERE ph.CreatedDate BETWEEN ? AND ?
          AND EXISTS (
            SELECT 1 FROM otc_history 
            WHERE otc_history.PatientId = ph.PatientId
              AND otc_history.CreatedDate BETWEEN ? AND ?
              AND COALESCE(otc_history.PaidAmount, otc_history.Cost, 0) > 60
          )
      ` : `
        SELECT
          ph.PatientId,
          ph.HistoryId,
          SUBSTR(ph.CreatedDate, 1, 10) AS DATE,
          chw.Village,
          division.Name,
          CASE WHEN pp.DoctorKP > 0 THEN 1 ELSE 0 END AS consultation,
          CASE WHEN pp.MedicineKP + pp.CorporateKP + pp.MarginKP + pp.MedicineFacilitationKP > 0 THEN 1 ELSE 0 END AS medicine,
          CASE WHEN pp.TestKP > 0 THEN 1 ELSE 0 END AS diagnostics,
          CASE WHEN pp.InjectionKP + pp.DripKP + pp.NebulizeKP + pp.DressingKP + pp.FacilityKP > 0 THEN 1 ELSE 0 END AS poc,
          0 AS otc,
          0 AS eye
        FROM patient_history ph
        LEFT JOIN prescription_pricing pp ON pp.HistoryId = ph.HistoryId
        LEFT JOIN patient ON patient.PatientId = ph.PatientId
        LEFT JOIN chw ON chw.ID = patient.Centre
        JOIN division ON division.Id = chw.DivisionId
        WHERE ph.CreatedDate BETWEEN ? AND ?
          AND EXISTS (
            SELECT 1 FROM otc_history 
            WHERE otc_history.PatientId = ph.PatientId
              AND otc_history.CreatedDate BETWEEN ? AND ?
              AND COALESCE(otc_history.PaidAmount, otc_history.Cost, 0) > 60
          )
      `;
      const patientParams = [from, to, from, to];
      if (divisionName && typeof divisionName === 'string' && divisionName.trim() !== '') {
        patientQuery += ' AND division.Name = ?';
        patientParams.push(divisionName);
      } else {
        patientQuery += ' AND division.Id != 5';
      }
      if (centreId) {
        patientQuery += ' AND chw.ID = ?';
        patientParams.push(Number(centreId));
      }
      patientQuery += ' GROUP BY SUBSTR(ph.CreatedDate, 1, 10) ORDER BY DATE ASC;';

      const [rows] = await pool.execute(patientQuery, patientParams);
      patientData = rows;
    }

    /* =======================
       OTC FOOTFALL (only count if OTC > 60)
    ======================== */
    if (type === 'otc' || type === 'combined') {
      let otcQuery = skipDetails ? `
        SELECT
          SUBSTR(otc_history.CreatedDate, 1, 10) AS DATE,
          0 AS consultation,
          COUNT(DISTINCT CASE WHEN a.MedicineKP > 0 THEN otc_history.OtcId END) AS medicine,
          COUNT(DISTINCT CASE WHEN d.TestKP > 0 THEN otc_history.OtcId END) AS diagnostics,
          COUNT(DISTINCT CASE WHEN otc_history.Injection > 0 THEN otc_history.OtcId END) AS poc,
          COUNT(DISTINCT CASE WHEN COALESCE(otc_history.PaidAmount, otc_history.Cost, 0) > COALESCE(a.MedicineKP, 0) + COALESCE(d.TestKP, 0) + COALESCE(otc_history.Injection, 0) THEN otc_history.OtcId END) AS otc,
          0 AS eye
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
          AND COALESCE(otc_history.PaidAmount, otc_history.Cost, 0) > 60
      ` : `
        SELECT
          patient.PatientId,
          otc_history.OtcId,
          SUBSTR(otc_history.CreatedDate, 1, 10) AS DATE,
          chw.Village,
          division.Name,
          0 AS consultation,
          CASE WHEN a.MedicineKP > 0 THEN 1 ELSE 0 END AS medicine,
          CASE WHEN d.TestKP > 0 THEN 1 ELSE 0 END AS diagnostics,
          CASE WHEN otc_history.Injection > 0 THEN 1 ELSE 0 END AS poc,
          CASE WHEN COALESCE(otc_history.PaidAmount, otc_history.Cost, 0) > COALESCE(a.MedicineKP, 0) + COALESCE(d.TestKP, 0) + COALESCE(otc_history.Injection, 0) THEN 1 ELSE 0 END AS otc,
          0 AS eye
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
          AND COALESCE(otc_history.PaidAmount, otc_history.Cost, 0) > 60
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
      otcQuery += ' GROUP BY SUBSTR(otc_history.CreatedDate, 1, 10) ORDER BY DATE ASC;';

      const [rows] = await pool.execute(otcQuery, otcParams);
      otcData = rows;
    }

    /* =======================
       BUILD DAILY FOOTFALL WITH CATEGORY BREAKDOWN
    ======================== */
    const dailyByDate = {};
    let totalFootfall = 0;

    const accumulate = (rows, source) => {
      if (skipDetails) {
        // For skipDetails, rows are already aggregated by date
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
          day.consultation += Number(r.consultation ?? 0);
          day.medicine += Number(r.medicine ?? 0);
          day.otc += Number(r.otc ?? 0);
          day.diagnostics += Number(r.diagnostics ?? 0);
          day.poc += Number(r.poc ?? 0);
          day.eye += Number(r.eye ?? 0);
          // Total is sum of all categories (each visit can be in multiple categories)
          day.total = day.consultation + day.medicine + day.otc + day.diagnostics + day.poc + day.eye;
        });
      } else {
        // For detailed rows, count distinct visits per category
        const visitsByDate = {};
        rows.forEach((r) => {
          const date = r.DATE;
          if (!date) return;
          if (!visitsByDate[date]) {
            visitsByDate[date] = {
              consultation: new Set(),
              medicine: new Set(),
              otc: new Set(),
              diagnostics: new Set(),
              poc: new Set(),
              eye: new Set(),
            };
          }
          const visitId = source === "otc" ? r.OtcId : r.HistoryId;
          if (Number(r.consultation ?? 0) > 0) visitsByDate[date].consultation.add(visitId);
          if (Number(r.medicine ?? 0) > 0) visitsByDate[date].medicine.add(visitId);
          if (Number(r.otc ?? 0) > 0) visitsByDate[date].otc.add(visitId);
          if (Number(r.diagnostics ?? 0) > 0) visitsByDate[date].diagnostics.add(visitId);
          if (Number(r.poc ?? 0) > 0) visitsByDate[date].poc.add(visitId);
          if (Number(r.eye ?? 0) > 0) visitsByDate[date].eye.add(visitId);
        });
        
        Object.keys(visitsByDate).forEach((date) => {
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
          const visits = visitsByDate[date];
          day.consultation = visits.consultation.size;
          day.medicine = visits.medicine.size;
          day.otc = visits.otc.size;
          day.diagnostics = visits.diagnostics.size;
          day.poc = visits.poc.size;
          day.eye = visits.eye.size;
          // Total is union of all visits
          const allVisits = new Set([
            ...visits.consultation,
            ...visits.medicine,
            ...visits.otc,
            ...visits.diagnostics,
            ...visits.poc,
            ...visits.eye,
          ]);
          day.total = allVisits.size;
        });
      }
    };

    if (type === "otc" || type === "combined") {
      accumulate(otcData, "otc");
    }
    if (type === "patient" || type === "combined") {
      accumulate(patientData, "patient");
    }

    // Calculate total footfall
    totalFootfall = Object.values(dailyByDate).reduce((sum, day) => sum + day.total, 0);

    const dailyFootfall = Object.values(dailyByDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({
        date: r.date,
        total_footfall: r.total,
        consultation: r.consultation,
        medicine: r.medicine,
        otc: r.otc,
        diagnostics: r.diagnostics,
        poc: r.poc,
        eye: r.eye,
      }));

    const response = {
      type,
      from,
      to,
      totalFootfall,
      dailyFootfall,
    };
    
    // Only include detail rows if not skipped
    if (!skipDetails) {
      response.patientRows = patientData;
      response.otcRows = otcData;
    }
    
    return res.json(response);

  } catch (err) {
    console.error('FOOTFALL BY MONTH ERROR:', err);
    res.status(500).json({ message: 'Database error', error: err.message });
  }
};

