import api from './http';

export const partnerService = {
  getPartners: async (params = {}) => {
    const { data } = await api.get('/partners', { params });
    return data;
  },

  createPartner: async (payload) => {
    const { data } = await api.post('/partners', payload);
    return data;
  },

  updatePartner: async (id, payload) => {
    const { data } = await api.patch(`/partners/${id}`, payload);
    return data;
  },

  deletePartner: async (id) => {
    const { data } = await api.delete(`/partners/${id}`);
    return data;
  },

  getContacts: async (partnerId) => {
    const { data } = await api.get(`/partners/${partnerId}/contacts`);
    return data;
  },

  createContact: async (partnerId, payload) => {
    const { data } = await api.post(`/partners/${partnerId}/contacts`, payload);
    return data;
  },

  updateContact: async (partnerId, contactId, payload) => {
    const { data } = await api.patch(`/partners/${partnerId}/contacts/${contactId}`, payload);
    return data;
  },

  deleteContact: async (partnerId, contactId) => {
    const { data } = await api.delete(`/partners/${partnerId}/contacts/${contactId}`);
    return data;
  }
};
