module.exports = `
SELECT
    DATE(o.CreatedDate) AS date,

    SUM(o.Cost) AS total_cost,
    SUM(o.PaidAmount) AS paid_amount,
    SUM(o.Discount) AS discount,
    SUM(o.NonPayment) AS non_payment,
    SUM(o.Injection) AS others,

    SUM(IFNULL(m.MedicineKP,0)) AS medicine_revenue,
    SUM(IFNULL(t.TestKP,0)) AS test_revenue

FROM otc_history o

LEFT JOIN (
    SELECT pr.OtcId, SUM(pr.Cost) AS MedicineKP
    FROM prescription pr
    JOIN otc_history o2 ON o2.OtcId = pr.OtcId
    WHERE o2.CreatedDate BETWEEN ? AND ?
    GROUP BY pr.OtcId
) m ON m.OtcId = o.OtcId

LEFT JOIN (
    SELECT dg.OtcId, SUM(dg.Cost) AS TestKP
    FROM diagnostic dg
    JOIN otc_history o3 ON o3.OtcId = dg.OtcId
    WHERE o3.CreatedDate BETWEEN ? AND ?
    GROUP BY dg.OtcId
) t ON t.OtcId = o.OtcId

JOIN patient p ON p.PatientId = o.PatientId
JOIN chw c ON c.ID = p.Centre
JOIN division d ON d.Id = c.DivisionId

WHERE o.CreatedDate BETWEEN ? AND ?

GROUP BY DATE(o.CreatedDate)
ORDER BY date;
`;
