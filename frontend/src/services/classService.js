import api from './http';

export const classService = {
  getClasses: async (params = {}) => {
    const { data } = await api.get('/classes', { params });
    return data;
  },

  getClassById: async (id) => {
    const { data } = await api.get(`/classes/${id}`);
    return data;
  },

  createClass: async (payload) => {
    const { data } = await api.post('/classes', payload);
    return data;
  },

  updateClass: async (id, payload) => {
    const { data } = await api.patch(`/classes/${id}`, payload);
    return data;
  },

  deleteClass: async (id) => {
    const { data } = await api.delete(`/classes/${id}`);
    return data;
  },

  getClassStudents: async (classId, params = {}) => {
    const { data } = await api.get(`/classes/${classId}/students`, { params });
    return data;
  },

  addClassStudent: async (classId, payload) => {
    const { data } = await api.post(`/classes/${classId}/students`, payload);
    return data;
  },

  updateClassStudent: async (classId, classStudentId, payload) => {
    const { data } = await api.patch(`/classes/${classId}/students/${classStudentId}`, payload);
    return data;
  },

  deleteClassStudent: async (classId, classStudentId) => {
    const { data } = await api.delete(`/classes/${classId}/students/${classStudentId}`);
    return data;
  }
};
