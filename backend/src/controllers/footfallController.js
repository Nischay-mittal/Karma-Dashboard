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
 * Footfall API - speciality-based (doctor speciality bifurcation)
 * Combines:
 * 1. OTC visits (otc_history) - linked to doctor via most recent patient_history
 * 2. Clinic visits (patient_history) - direct doctor link to doctor.speciality_e
 * OTC only if PaidAmount/Cost > 60.
 */
exports.getFootfallByMonth = async (req, res) => {
  try {
    console.log('HIT /api/footfall/by-month');
    console.log('BODY:', req.body);

    const { from, to, divisionName, centreId, skipDetails } = req.body;

    if (!from || !to) {
      return res.status(400).json({ message: 'Missing parameters (from, to)' });
    }

    const params = [from, to];
    if (divisionName && divisionName.trim()) params.push(divisionName);
    if (centreId) params.push(Number(centreId));

    const divFilter = divisionName && divisionName.trim() ? ' AND d.Name = ?' : '';
    const cenFilter = centreId ? ' AND c.ID = ?' : '';

    // OTC -> patient_history (most recent) -> karma_doctor; match on doctorId
    const doctorJoin = `LEFT JOIN patient_history ph ON ph.PatientId = oh.PatientId AND ph.CreatedDate = (
      SELECT MAX(ph2.CreatedDate) FROM patient_history ph2
      WHERE ph2.PatientId = oh.PatientId AND ph2.CreatedDate <= oh.CreatedDate
    ) LEFT JOIN karma_doctor kd ON kd.DoctorId = COALESCE(ph.doctorID, ph.doctorId)`;

    let rows = [];
    if (skipDetails) {
      const otcAggQuery = `
        SELECT SUBSTR(oh.CreatedDate, 1, 10) AS DATE,
          COALESCE(NULLIF(TRIM(kd.Speciality), ''), 'other') AS speciality,
          COALESCE(NULLIF(TRIM(kd.Name), ''), NULLIF(TRIM(kd.name), ''), 'Unknown') AS doctor_name,
          CONCAT(
            COALESCE(NULLIF(TRIM(kd.Name), ''), NULLIF(TRIM(kd.name), ''), 'Unknown'),
            ' - ',
            COALESCE(NULLIF(TRIM(kd.Speciality), ''), 'other')
          ) AS doctor_label,
          COUNT(*) AS cnt
        FROM otc_history oh
        LEFT JOIN patient p ON p.PatientId = oh.PatientId
        LEFT JOIN chw c ON c.ID = p.Centre
        LEFT JOIN division d ON d.Id = c.DivisionId
        ${doctorJoin}
        WHERE oh.CreatedDate BETWEEN ? AND ? AND COALESCE(oh.PaidAmount, oh.Cost, 0) > 60 ${divFilter} ${cenFilter}
        GROUP BY SUBSTR(oh.CreatedDate, 1, 10), doctor_label
      `;
      const phAggQuery = `
        SELECT SUBSTR(ph.CreatedDate, 1, 10) AS DATE,
          COALESCE(NULLIF(TRIM(kd.Speciality), ''), 'other') AS speciality,
          COALESCE(NULLIF(TRIM(kd.Name), ''), NULLIF(TRIM(kd.name), ''), 'Unknown') AS doctor_name,
          CONCAT(
            COALESCE(NULLIF(TRIM(kd.Name), ''), NULLIF(TRIM(kd.name), ''), 'Unknown'),
            ' - ',
            COALESCE(NULLIF(TRIM(kd.Speciality), ''), 'other')
          ) AS doctor_label,
          COUNT(*) AS cnt
        FROM patient_history ph
        LEFT JOIN patient p ON p.PatientId = ph.PatientId
        LEFT JOIN chw c ON c.ID = p.Centre
        LEFT JOIN division d ON d.Id = c.DivisionId
        LEFT JOIN karma_doctor kd ON kd.DoctorId = COALESCE(ph.doctorID, ph.doctorId)
        WHERE ph.CreatedDate BETWEEN ? AND ? AND ph.Status = 'A' ${divFilter} ${cenFilter}
        GROUP BY SUBSTR(ph.CreatedDate, 1, 10), doctor_label
      `;
      const [[otcRows], [phRows]] = await Promise.all([
        pool.execute(otcAggQuery.replace(/\s+/g, ' ').trim(), params),
        pool.execute(phAggQuery.replace(/\s+/g, ' ').trim(), params),
      ]);
      rows = [...otcRows, ...phRows];
    } else {
      const otcDetailQuery = `
        WITH medicine AS (SELECT OtcId, SUM(Cost) AS medicine_revenue FROM prescription GROUP BY OtcId),
        diagnostic_cost AS (SELECT OtcId, SUM(Cost) AS diagnostic_revenue FROM diagnostic GROUP BY OtcId)
        SELECT DATE(oh.CreatedDate) AS date, DATE_FORMAT(oh.CreatedDate, '%Y-%m-%d') AS date_str,
          d.Name AS division, c.Village AS center, p.PatientId, p.Sex AS gender,
          COALESCE(NULLIF(TRIM(kd.Name), ''), NULLIF(TRIM(kd.name), ''), 'Unknown') AS doctor_name,
          COALESCE(NULLIF(TRIM(kd.Speciality), ''), 'other') AS speciality,
          CONCAT(
            COALESCE(NULLIF(TRIM(kd.Name), ''), NULLIF(TRIM(kd.name), ''), 'Unknown'),
            ' - ', COALESCE(NULLIF(TRIM(kd.Speciality), ''), 'other')
          ) AS doctor_label,
          COALESCE(oh.PaidAmount, 0) AS revenue, COALESCE(m.medicine_revenue, 0) AS medicine_revenue,
          COALESCE(dc.diagnostic_revenue, 0) AS diagnostic_revenue,
          COALESCE(oh.PaidAmount, 0) - COALESCE(m.medicine_revenue, 0) - COALESCE(dc.diagnostic_revenue, 0) AS consultation_revenue,
          'OTC' AS source
        FROM otc_history oh
        LEFT JOIN patient p ON p.PatientId = oh.PatientId
        LEFT JOIN chw c ON c.ID = p.Centre
        LEFT JOIN division d ON d.Id = c.DivisionId
        LEFT JOIN medicine m ON m.OtcId = oh.OtcId
        LEFT JOIN diagnostic_cost dc ON dc.OtcId = oh.OtcId
        ${doctorJoin}
        WHERE oh.CreatedDate BETWEEN ? AND ? AND COALESCE(oh.PaidAmount, oh.Cost, 0) > 60 ${divFilter} ${cenFilter}
      `;
      const phDetailQuery = `
        SELECT DATE(ph.CreatedDate) AS date, DATE_FORMAT(ph.CreatedDate, '%Y-%m-%d') AS date_str,
          d.Name AS division, c.Village AS center, p.PatientId, p.Sex AS gender,
          COALESCE(NULLIF(TRIM(kd.Name), ''), NULLIF(TRIM(kd.name), ''), 'Unknown') AS doctor_name,
          COALESCE(NULLIF(TRIM(kd.Speciality), ''), 'other') AS speciality,
          CONCAT(
            COALESCE(NULLIF(TRIM(kd.Name), ''), NULLIF(TRIM(kd.name), ''), 'Unknown'),
            ' - ', COALESCE(NULLIF(TRIM(kd.Speciality), ''), 'other')
          ) AS doctor_label,
          COALESCE(ph.COST, 0) AS revenue, 0 AS medicine_revenue, 0 AS diagnostic_revenue,
          COALESCE(ph.COST, 0) AS consultation_revenue, 'Clinic' AS source
        FROM patient_history ph
        LEFT JOIN patient p ON p.PatientId = ph.PatientId
        LEFT JOIN chw c ON c.ID = p.Centre
        LEFT JOIN division d ON d.Id = c.DivisionId
        LEFT JOIN karma_doctor kd ON kd.DoctorId = COALESCE(ph.doctorID, ph.doctorId)
        WHERE ph.CreatedDate BETWEEN ? AND ? AND ph.Status = 'A' ${divFilter} ${cenFilter}
      `;
      const [[otcRows], [phRows]] = await Promise.all([
        pool.execute(otcDetailQuery.replace(/\s+/g, ' ').trim(), params),
        pool.execute(phDetailQuery.replace(/\s+/g, ' ').trim(), params),
      ]);
      rows = [...otcRows, ...phRows].sort((a, b) => (a.date_str || a.date || '').localeCompare(b.date_str || b.date || ''));
    }

    const getSpec = (r) => {
      // We only care about the speciality for chart bifurcations.
      // Doctor names should not influence the grouping.
      const spec = r.speciality ?? r.specialty ?? r.Speciality ?? r.SPECIALITY ?? r.speciality_e ?? null;
      const s = String(spec ?? 'other').trim();
      return s || 'other';
    };

    const dailyByDate = {};
    const specialitiesSet = new Set();

    if (skipDetails) {
      rows.forEach((r) => {
        const rawDate = r.DATE ?? r.date ?? r.date_str;
        const date = rawDate != null ? String(rawDate).slice(0, 10) : null;
        if (!date) return;
        const spec = getSpec(r);
        specialitiesSet.add(spec);
        if (!dailyByDate[date]) dailyByDate[date] = { date, total: 0 };
        const cnt = Number(r.cnt ?? 0);
        dailyByDate[date].total += cnt;
        dailyByDate[date][spec] = (dailyByDate[date][spec] || 0) + cnt;
      });
    } else {
      rows.forEach((r) => {
        const rawDate = r.date_str ?? r.date ?? r.DATE;
        const date = rawDate != null ? String(rawDate).slice(0, 10) : null;
        if (!date) return;
        const spec = getSpec(r);
        specialitiesSet.add(spec);
        if (!dailyByDate[date]) dailyByDate[date] = { date, total: 0 };
        dailyByDate[date].total += 1;
        dailyByDate[date][spec] = (dailyByDate[date][spec] || 0) + 1;
      });
    }

    const specialities = Array.from(specialitiesSet).sort();
    const specialityTotals = {};
    specialities.forEach((s) => { specialityTotals[s] = 0; });

    const dailyFootfall = Object.values(dailyByDate)
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      .map((r) => {
        const copy = { date: r.date, total: r.total, total_footfall: r.total };
        specialities.forEach((spec) => {
          const v = r[spec] || 0;
          copy[spec] = v;
          specialityTotals[spec] = (specialityTotals[spec] || 0) + v;
        });
        return copy;
      });

    const totalFootfall = dailyFootfall.reduce((s, d) => s + (d.total_footfall || d.total || 0), 0);

    console.log('getFootfallByMonth response:', {
      totalFootfall,
      specialities,
      specialityBreakdown: specialityTotals,
      dailyRows: dailyFootfall.length,
      sampleRow: dailyFootfall[0],
    });

    const response = {
      from,
      to,
      totalFootfall,
      dailyFootfall,
      specialities,
      specialityBreakdown: specialityTotals,
    };
    if (!skipDetails) {
      response.detailRows = rows;
    }
    return res.json(response);
  } catch (err) {
    console.error('FOOTFALL BY MONTH ERROR:', err);
    res.status(500).json({ message: 'Database error', error: err.message });
  }
};
