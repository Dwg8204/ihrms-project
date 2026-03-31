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

  updateExamResult: async (id, payload) => {
    const { data } = await api.patch(`/exam-applications/${id}/result`, payload);
    return data;
  },
};
