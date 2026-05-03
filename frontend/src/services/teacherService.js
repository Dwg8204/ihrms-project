import api from './http';

export const teacherService = {
  getTeachers: async (params = {}) => {
    const { data } = await api.get('/teachers', { params });
    return data;
  },

  createTeacher: async (payload) => {
    const { data } = await api.post('/teachers', payload);
    return data;
  },

  updateTeacher: async (id, payload) => {
    const { data } = await api.patch(`/teachers/${id}`, payload);
    return data;
  },

  deleteTeacher: async (id) => {
    const { data } = await api.delete(`/teachers/${id}`);
    return data;
  }
};
