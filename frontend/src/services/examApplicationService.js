import api from "./http";

export const examApplicationService = {
  createExamApplication: async (payload) => {
    const { data } = await api.post("/exam-applications", payload);
    return data;
  },

  getExamApplications: async (params = {}) => {
    const { data } = await api.get("/exam-applications", { params });
    return data;
  },

  getExamSessions: async (params = {}) => {
    const { data } = await api.get("/exam-applications/sessions", { params });
    return data;
  },

  getExamSessionDetail: async (sessionKey) => {
    const { data } = await api.get(`/exam-applications/sessions/${sessionKey}`);
    return data;
  },

  getPendingCandidatesByJobOrder: async (jobOrderId) => {
    const { data } = await api.get(`/exam-applications/job-orders/${jobOrderId}/pending-candidates`);
    return data;
  },

  updateExamSession: async (sessionKey, payload) => {
    const { data } = await api.patch(`/exam-applications/sessions/${sessionKey}`, payload);
    return data;
  },

  bulkScheduleSession: async (payload) => {
    const { data } = await api.post("/exam-applications/sessions/bulk-schedule", payload);
    return data;
  },

  updateExamSchedule: async (id, payload) => {
    const { data } = await api.patch(`/exam-applications/${id}/schedule`, payload);
    return data;
  },

  updateExamResult: async (id, payload) => {
    const { data } = await api.patch(`/exam-applications/${id}/result`, payload);
    return data;
  },

  deleteExamApplication: async (id) => {
    const { data } = await api.delete(`/exam-applications/${id}`);
    return data;
  }
};
