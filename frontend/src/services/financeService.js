import http from "./http";

export const financeService = {
  // Fee Standards
  getFeeStandards: (params) => http.get("/fee-standards", { params }).then(res => res.data),
  getFeeStandardById: (id) => http.get(`/fee-standards/${id}`).then(res => res.data),
  createFeeStandard: (data) => http.post("/fee-standards", data).then(res => res.data),
  updateFeeStandard: (id, data) => http.patch(`/fee-standards/${id}`, data).then(res => res.data),
  deleteFeeStandard: (id) => http.delete(`/fee-standards/${id}`).then(res => res.data),

  // Transactions
  getAllTransactions: (params) => http.get('/transactions', { params }).then(res => res.data),
  getTransactionsByCandidate: (candidateId, params) => 
    http.get(`/transactions/candidate/${candidateId}`, { params }).then(res => res.data),
  recordIncome: (data) => http.post("/transactions/income", data).then(res => res.data),
  recordRefund: (data) => http.post("/transactions/refund", data).then(res => res.data),

  // Payment Schedules
  createPaymentSchedule: (data) =>
    http.post('/payment-schedules', data).then(res => res.data),
  getPaymentSchedulesByCandidate: (candidateId) => 
    http.get(`/payment-schedules/candidate/${candidateId}`).then(res => res.data),
  recordPayment: (scheduleId, data) => 
    http.post(`/payment-schedules/${scheduleId}/pay`, data).then(res => res.data),
  recordRefund: (scheduleId, data) => 
    http.post(`/payment-schedules/${scheduleId}/refund`, data).then(res => res.data),
  checkExitReadiness: (candidateId) => 
    http.get(`/payment-schedules/readiness-for-exit/${candidateId}`).then(res => res.data),
  processRefundsManually: (candidateId, refundCaseType) => 
    http.post(`/payment-schedules/${candidateId}/refund-process`, { refundCaseType }).then(res => res.data)
};
