module.exports = `
SELECT
    DATE(ph.CreatedDate) AS date,

    SUM(ph.COST) AS consultation_cost,

    SUM(
        IFNULL(pp.MedicineKP,0) +
        IFNULL(pp.CorporateKP,0) +
        IFNULL(pp.MarginKP,0) +
        IFNULL(pp.MedicineFacilitationKP,0)
    ) AS medicine_revenue,

    SUM(IFNULL(pp.ManualFees,0)) AS manual_fees,
    SUM(IFNULL(pp.Adjustment,0)) AS adjustment,
    SUM(IFNULL(pp.DoctorKP,0)) AS doctor_revenue,

    SUM(
        IFNULL(pp.TestKP,0) +
        IFNULL(pp.InjectionKP,0) +
        IFNULL(pp.DripKP,0) +
        IFNULL(pp.NebulizeKP,0) +
        IFNULL(pp.DressingKP,0) +
        IFNULL(pp.FacilityKP,0)
    ) AS other_services,

    SUM(IFNULL(r.reconcilemedicine,0)) AS reconcile_medicine

FROM patient_history ph

LEFT JOIN prescription_pricing pp
    ON pp.HistoryId = ph.HistoryId

LEFT JOIN (
    SELECT 
        HistoryId,
        ROUND(
            SUM(
                CASE 
                    WHEN ReconciledQuantity IS NULL 
                    THEN Cost 
                    ELSE (ReconciledQuantity * Cost) / Quantity 
                END
            )
        ) AS reconcilemedicine
    FROM prescription
    GROUP BY HistoryId
) r ON r.HistoryId = ph.HistoryId

JOIN patient p ON p.PatientId = ph.PatientId
JOIN chw c ON c.ID = p.Centre
JOIN division d ON d.Id = c.DivisionId

WHERE ph.CreatedDate BETWEEN ? AND ?
AND d.Id != 5

GROUP BY DATE(ph.CreatedDate)
ORDER BY date;
`;
