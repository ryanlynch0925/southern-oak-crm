export const financeKpis = [
  { id: "pipeline", label: "Estimated Pipeline", value: 74300, subtitle: "18 estimates", trend: "up", trendLabel: "12% from Apr", icon: "ti-clipboard-list" },
  { id: "accepted", label: "Accepted Revenue", value: 142600, subtitle: "22 jobs", trend: "up", trendLabel: "18% from Apr", icon: "ti-checklist" },
  { id: "scheduled", label: "Scheduled Revenue", value: 98450, subtitle: "15 jobs", trend: "up", trendLabel: "8% from Apr", icon: "ti-calendar-event" },
  { id: "completed", label: "Completed Revenue", value: 86250, subtitle: "12 jobs", trend: "up", trendLabel: "22% from Apr", icon: "ti-cash" },
  { id: "collected", label: "Collected This Month", value: 64800, subtitle: "9 payments", trend: "up", trendLabel: "15% from Apr", icon: "ti-credit-card-pay" },
  { id: "outstanding", label: "Outstanding Balance", value: 31450, subtitle: "11 open invoices", trend: "up", trendLabel: "5% from Apr", icon: "ti-alert-circle" },
];

export const revenueByStatus = [
  { label: "New Request", value: 74300, color: "#5A89B8" },
  { label: "Estimate Sent", value: 36800, color: "#7C92AE" },
  { label: "Estimate Accepted", value: 142600, color: "#3F7B56" },
  { label: "Ready to Schedule", value: 48900, color: "#A78627" },
  { label: "Scheduled", value: 98450, color: "#4A6D50" },
  { label: "In Progress", value: 0, color: "#8A78B2" },
  { label: "Completed", value: 86250, color: "#2F6A47" },
  { label: "Paid", value: 64300, color: "#275A85" },
  { label: "Lost", value: 8500, color: "#A05959" },
];

export const revenueByServiceType = [
  { label: "Driveways", value: 128450, color: "#2F6A47" },
  { label: "Patios", value: 98200, color: "#B07A2A" },
  { label: "Slabs", value: 62300, color: "#446884" },
  { label: "Stamped Concrete", value: 47600, color: "#8D6446" },
  { label: "Block Foundations", value: 28450, color: "#65714D" },
  { label: "Pole Barn Slabs", value: 21300, color: "#5B4A88" },
  { label: "Sidewalks", value: 9150, color: "#7B8A95" },
  { label: "Repairs / Other", value: 6150, color: "#A05C54" },
];

export const residentialVsBuilder = {
  residential: { value: 231200, percent: 58 },
  builder: { value: 170400, percent: 42 },
  total: 401600,
};

export const computeBalanceDue = (finalPrice: number, amountPaid: number) => finalPrice - amountPaid;
export const computeTotalCost = (materialCost: number, laborCost: number, equipmentCost: number, otherCost: number) => materialCost + laborCost + equipmentCost + otherCost;
export const computeGrossProfit = (finalPrice: number, totalCost: number) => finalPrice - totalCost;
export const computeGrossMargin = (grossProfit: number, finalPrice: number) => finalPrice > 0 ? grossProfit / finalPrice : 0;

export const financeJobs = [
  { customer: "Robert Tanner", project: "Pole Barn Slab", finalPrice: 22800, amountPaid: 10000, dueDate: "2026-05-20", status: "Past Due", customerType: "Residential", jobType: "Pole Barn Slab", materialCost: 6200, laborCost: 3400, equipmentCost: 900, otherCost: 700 },
  { customer: "Mike Johnson", project: "Driveway", finalPrice: 9200, amountPaid: 4600, dueDate: "2026-05-28", status: "Past Due", customerType: "Residential", jobType: "Driveway", materialCost: 2200, laborCost: 1800, equipmentCost: 300, otherCost: 150 },
  { customer: "Sarah Davis", project: "Stamped Patio", finalPrice: 10200, amountPaid: 5200, dueDate: "2026-06-05", status: "Due Soon", customerType: "Residential", jobType: "Stamped Concrete", materialCost: 3600, laborCost: 3500, equipmentCost: 900, otherCost: 600 },
  { customer: "Linda Weston", project: "Sidewalk", finalPrice: 1900, amountPaid: 950, dueDate: "2026-06-06", status: "Due Soon", customerType: "Residential", jobType: "Sidewalk", materialCost: 500, laborCost: 350, equipmentCost: 40, otherCost: 20 },
  { customer: "Tom Baker", project: "Slab", finalPrice: 7500, amountPaid: 2500, dueDate: "2026-06-10", status: "Not Due", customerType: "Builder", jobType: "Slab", materialCost: 2100, laborCost: 2600, equipmentCost: 650, otherCost: 550 },
  { customer: "Derek Fountain", project: "Columns", finalPrice: 4000, amountPaid: 1200, dueDate: "2026-06-14", status: "Not Due", customerType: "Residential", jobType: "Columns", materialCost: 900, laborCost: 1650, equipmentCost: 350, otherCost: 350 },
];

export const financePayments = [
  { date: "2026-05-29", customerJob: "Mike Johnson - Driveway", amount: 4600, method: "Check", remainingBalance: 4600 },
  { date: "2026-05-27", customerJob: "Sarah Davis - Stamped Patio", amount: 5200, method: "ACH", remainingBalance: 5000 },
  { date: "2026-05-25", customerJob: "Robert Tanner - Pole Barn Slab", amount: 10000, method: "Check", remainingBalance: 12800 },
  { date: "2026-05-22", customerJob: "Tom Baker - Slab", amount: 2500, method: "Card", remainingBalance: 5000 },
  { date: "2026-05-19", customerJob: "Linda Weston - Sidewalk", amount: 950, method: "Check", remainingBalance: 950 },
];

export const receivables = financeJobs.slice(0, 5).map(job => ({
  customer: job.customer,
  project: job.project,
  finalPrice: job.finalPrice,
  paid: job.amountPaid,
  balanceDue: computeBalanceDue(job.finalPrice, job.amountPaid),
  dueDate: job.dueDate,
  status: job.status,
  daysOverdue: job.status === "Past Due" ? Math.max(0, Math.round((new Date("2026-05-31").getTime() - new Date(job.dueDate).getTime()) / 86400000)) : null,
}));

export const lowMarginJobs = [
  { customer: "Sarah Davis", project: "Stamped Patio", finalPrice: 10200, materialCost: 3600, laborCost: 3500, equipmentCost: 900, otherCost: 600, status: "Completed" },
  { customer: "Derek Fountain", project: "Columns", finalPrice: 4000, materialCost: 900, laborCost: 1650, equipmentCost: 350, otherCost: 350, status: "In Progress" },
  { customer: "Tom Baker", project: "Slab", finalPrice: 7500, materialCost: 2100, laborCost: 2600, equipmentCost: 650, otherCost: 550, status: "Scheduled" },
].map(job => {
  const totalCost = computeTotalCost(job.materialCost, job.laborCost, job.equipmentCost, job.otherCost);
  const grossProfit = computeGrossProfit(job.finalPrice, totalCost);
  const grossMargin = computeGrossMargin(grossProfit, job.finalPrice);
  return {
    customer: job.customer,
    project: job.project,
    finalPrice: job.finalPrice,
    totalCost,
    grossProfit,
    grossMargin,
    status: job.status,
  };
});
