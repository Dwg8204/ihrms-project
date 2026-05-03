import api from './http';

export const emailService = {
  getTemplates: async (params = {}) => {
    const { data } = await api.get('/emails/templates', { params });
    return data;
  },

  getTemplateById: async (id) => {
    const { data } = await api.get(`/emails/templates/${id}`);
    return data;
  },

  createTemplate: async (payload) => {
    const { data } = await api.post('/emails/templates', payload);
    return data;
  },

  updateTemplate: async (id, payload) => {
    const { data } = await api.patch(`/emails/templates/${id}`, payload);
    return data;
  },

  deleteTemplate: async (id) => {
    const { data } = await api.delete(`/emails/templates/${id}`);
    return data;
  },

  getLogs: async (params = {}) => {
    const { data } = await api.get('/emails/logs', { params });
    return data;
  },

  sendManual: async (payload) => {
    const { data } = await api.post('/emails/manual-send', payload);
    return data;
  }
};
