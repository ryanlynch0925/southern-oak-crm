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

export const revenueSummary = [
  { id: "total", label: "Total Revenue", value: 401600, subtitle: "All tracked revenue" },
  { id: "accepted", label: "Accepted Revenue", value: 142600, subtitle: "22 approved jobs" },
  { id: "scheduled", label: "Scheduled Revenue", value: 98450, subtitle: "15 jobs on the board" },
  { id: "completed", label: "Completed Revenue", value: 86250, subtitle: "12 jobs completed" },
  { id: "lost", label: "Lost Revenue", value: 8500, subtitle: "3 estimates not won" },
  { id: "average", label: "Average Job Value", value: 7875, subtitle: "Across 51 tracked jobs" },
];

export const revenueStatusDetails = [
  { status: "New Request", count: 18, revenue: 74300, percentOfTotal: 18.5, note: "Prioritize estimate turnaround and first contact." },
  { status: "Estimate Sent", count: 9, revenue: 36800, percentOfTotal: 9.2, note: "Follow up on open quotes and objections." },
  { status: "Estimate Accepted", count: 22, revenue: 142600, percentOfTotal: 35.5, note: "Confirm scope and hold schedule windows." },
  { status: "Ready to Schedule", count: 7, revenue: 48900, percentOfTotal: 12.2, note: "Waiting on crew slot or final confirmation." },
  { status: "Scheduled", count: 15, revenue: 98450, percentOfTotal: 24.5, note: "Watch production timing and deposits." },
  { status: "In Progress", count: 4, revenue: 0, percentOfTotal: 0, note: "No revenue posted yet for active field work." },
  { status: "Completed", count: 12, revenue: 86250, percentOfTotal: 21.5, note: "Ready for collections and closeout." },
  { status: "Paid", count: 9, revenue: 64300, percentOfTotal: 16, note: "Cash collected and closed." },
  { status: "Lost", count: 3, revenue: 8500, percentOfTotal: 2.1, note: "Review price, timing, and scope feedback." },
];

export const revenueServiceTypeDetails = [
  { serviceType: "Driveways", count: 14, revenue: 128450, percentOfRevenue: 31.9, averageJobValue: 9175 },
  { serviceType: "Patios", count: 11, revenue: 98200, percentOfRevenue: 24.4, averageJobValue: 8927 },
  { serviceType: "Slabs", count: 9, revenue: 62300, percentOfRevenue: 15.5, averageJobValue: 6922 },
  { serviceType: "Stamped Concrete", count: 5, revenue: 47600, percentOfRevenue: 11.9, averageJobValue: 9520 },
  { serviceType: "Block Foundations", count: 3, revenue: 28450, percentOfRevenue: 7.1, averageJobValue: 9483 },
  { serviceType: "Pole Barn Slabs", count: 2, revenue: 21300, percentOfRevenue: 5.3, averageJobValue: 10650 },
  { serviceType: "Sidewalks", count: 4, revenue: 9150, percentOfRevenue: 2.3, averageJobValue: 2288 },
  { serviceType: "Repairs / Other", count: 3, revenue: 6150, percentOfRevenue: 1.5, averageJobValue: 2050 },
];

export const revenueCustomerTypeDetails = [
  { customerType: "Residential", revenue: 231200, percentOfTotal: 58, jobCount: 33, averageJobValue: 7006, note: "Leads total revenue and drives most volume." },
  { customerType: "Builder", revenue: 170400, percentOfTotal: 42, jobCount: 18, averageJobValue: 9467, note: "Lower volume, but stronger average job size." },
];

export const revenueItems = [
  { customerBuilder: "Robert Tanner", project: "Pole Barn Slab", serviceType: "Pole Barn Slabs", customerType: "Residential", status: "Completed", revenue: 22800, paid: 10000, balance: 12800, dateStage: "2026-05-20" },
  { customerBuilder: "Mike Johnson", project: "Driveway", serviceType: "Driveways", customerType: "Residential", status: "Completed", revenue: 9200, paid: 4600, balance: 4600, dateStage: "2026-05-28" },
  { customerBuilder: "Sarah Davis", project: "Stamped Patio", serviceType: "Stamped Concrete", customerType: "Residential", status: "Completed", revenue: 10200, paid: 5200, balance: 5000, dateStage: "2026-06-05" },
  { customerBuilder: "Linda Weston", project: "Sidewalk", serviceType: "Sidewalks", customerType: "Residential", status: "Completed", revenue: 1900, paid: 950, balance: 950, dateStage: "2026-06-06" },
  { customerBuilder: "Tom Baker", project: "Slab", serviceType: "Slabs", customerType: "Builder", status: "Scheduled", revenue: 7500, paid: 2500, balance: 5000, dateStage: "2026-06-10" },
  { customerBuilder: "Derek Fountain", project: "Columns", serviceType: "Repairs / Other", customerType: "Residential", status: "In Progress", revenue: 4000, paid: 1200, balance: 2800, dateStage: "2026-06-14" },
];

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
