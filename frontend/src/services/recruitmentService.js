import api from './http';

export const recruitmentService = {
  getSources: async (params = {}) => {
    const { data } = await api.get('/recruitment-sources', { params });
    return data;
  },

  createSource: async (payload) => {
    const { data } = await api.post('/recruitment-sources', payload);
    return data;
  },

  updateSource: async (id, payload) => {
    const { data } = await api.patch(`/recruitment-sources/${id}`, payload);
    return data;
  },

  deleteSource: async (id) => {
    const { data } = await api.delete(`/recruitment-sources/${id}`);
    return data;
  },

  getCandidates: async (params = {}) => {
    const { data } = await api.get('/candidates', { params });
    return data;
  },

  getCandidateById: async (id) => {
    const { data } = await api.get(`/candidates/${id}`);
    return data;
  },

  createCandidate: async (formData) => {
    const { data } = await api.post('/candidates', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  },

  updateCandidate: async (id, formData) => {
    const { data } = await api.patch(`/candidates/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  },

  updateCandidateStatus: async (id, status) => {
    const { data } = await api.patch(`/candidates/${id}/status`, { status });
    return data;
  },

  deleteCandidate: async (id) => {
    const { data } = await api.delete(`/candidates/${id}`);
    return data;
  },

  getKanban: async (params = {}) => {
    const { data } = await api.get('/candidates/kanban', { params });
    return data;
  },

  getFunnelSummary: async (params = {}) => {
    const { data } = await api.get('/candidates/funnel-summary', { params });
    return data;
  }
};
