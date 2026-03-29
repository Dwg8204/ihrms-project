import api from './http';

export const jobOrderService = {
  getJobOrders: async (params = {}) => {
    const { data } = await api.get('/job-orders', { params });
    return data;
  },

  createJobOrder: async (payload) => {
    const { data } = await api.post('/job-orders', payload);
    return data;
  },

  updateJobOrder: async (id, payload) => {
    const { data } = await api.patch(`/job-orders/${id}`, payload);
    return data;
  },

  cancelJobOrder: async (id) => {
    const { data } = await api.delete(`/job-orders/${id}`);
    return data;
  },

  getMatchingCandidates: async (jobOrderId, params = {}) => {
    const { data } = await api.get(`/job-orders/${jobOrderId}/matching-candidates`, {
      params
    });
    return data;
  }
};
