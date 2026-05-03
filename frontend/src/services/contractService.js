import api from './http';

export const contractService = {
  getContracts: async (params = {}) => {
    const { data } = await api.get('/contracts', { params });
    return data;
  },

  getContractById: async (id) => {
    const { data } = await api.get(`/contracts/${id}`);
    return data;
  },

  createContract: async (payload) => {
    const headers = payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const { data } = await api.post('/contracts', payload, { headers });
    return data;
  },

  updateContract: async (id, payload) => {
    const headers = payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const { data } = await api.patch(`/contracts/${id}`, payload, { headers });
    return data;
  },

  deleteContract: async (id, payload = {}) => {
    const { data } = await api.delete(`/contracts/${id}`, { data: payload });
    return data;
  },

  getContractTemplates: async (params = {}) => {
    const { data } = await api.get('/contracts/templates', { params });
    return data;
  },

  getContractTemplateById: async (id) => {
    const { data } = await api.get(`/contracts/templates/${id}`);
    return data;
  },

  createContractTemplate: async (payload) => {
    const headers = payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const { data } = await api.post('/contracts/templates', payload, { headers });
    return data;
  },

  updateContractTemplate: async (id, payload) => {
    const headers = payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const { data } = await api.patch(`/contracts/templates/${id}`, payload, { headers });
    return data;
  },

  deleteContractTemplate: async (id) => {
    const { data } = await api.delete(`/contracts/templates/${id}`);
    return data;
  }
};
