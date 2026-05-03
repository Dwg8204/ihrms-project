import { useEffect, useMemo, useState } from "react";
import SectionHeader from "../components/SectionHeader";
import SegmentTabs from "../components/SegmentTabs";
import { useToast } from "../components/ToastProvider";
import { teacherService } from "../services/teacherService";
import { classService } from "../services/classService";
import { recruitmentService } from "../services/recruitmentService";
import { getErrorMessage } from "../utils/toast";

const initialTeacherForm = {
  full_name: "",
  phone: "",
  email: "",
  teacher_type: "LANGUAGE",
  employment_type: "FULL_TIME",
  status: "ACTIVE"
};

const initialClassForm = {
  class_name: "",
  class_type: "LANGUAGE",
  teacher_id: "",
  room: "",
  start_date: "",
  end_date: "",
  status: "PENDING"
};

const initialStudentForm = {
  candidate_id: "",
  enroll_date: "",
  status: "STUDYING",
  attitude_note: ""
};

const teacherTypeLabels = {
  LANGUAGE: "Giáo viên tiếng",
  SKILL: "Giáo viên nghề"
};

const employmentLabels = {
  FULL_TIME: "Cơ hữu",
  VISITING: "Thỉnh giảng"
};

const classStatusLabels = {
  PENDING: "Sắp mở",
  IN_PROGRESS: "Đang giảng dạy",
  COMPLETED: "Đã kết thúc"
};

const studentStatusLabels = {
  STUDYING: "Đang học",
  DROPPED: "Bỏ học",
  GRADUATED: "Tốt nghiệp"
};

function formatTeacherLabel(teacher) {
  if (!teacher) return "-";
  return `${teacher.full_name || "-"} (${teacherTypeLabels[teacher.teacher_type] || teacher.teacher_type})`;
}

function Module9TrainingPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("teachers");

  const [teachers, setTeachers] = useState([]);
  const [teacherCatalog, setTeacherCatalog] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classStudents, setClassStudents] = useState([]);
  const [candidates, setCandidates] = useState([]);

  const [teacherLoading, setTeacherLoading] = useState(false);
  const [classLoading, setClassLoading] = useState(false);
  const [rosterLoading, setRosterLoading] = useState(false);

  const [teacherForm, setTeacherForm] = useState(initialTeacherForm);
  const [classForm, setClassForm] = useState(initialClassForm);
  const [studentForm, setStudentForm] = useState(initialStudentForm);

  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [editingClassId, setEditingClassId] = useState(null);
  const [editingStudentId, setEditingStudentId] = useState(null);

  const [teacherSearch, setTeacherSearch] = useState("");
  const [teacherStatusFilter, setTeacherStatusFilter] = useState("");
  const [teacherTypeFilter, setTeacherTypeFilter] = useState("");

  const [classSearch, setClassSearch] = useState("");
  const [classStatusFilter, setClassStatusFilter] = useState("");
  const [classTypeFilter, setClassTypeFilter] = useState("");
  const [classTeacherFilter, setClassTeacherFilter] = useState("");

  const [selectedClassId, setSelectedClassId] = useState(null);

  const totalTeachers = teachers.length;
  const totalClasses = classes.length;

  const teacherOptions = useMemo(
    () => teacherCatalog.filter((teacher) => teacher.status === "ACTIVE"),
    [teacherCatalog]
  );

  const selectedClass = useMemo(
    () => classes.find((item) => Number(item.id) === Number(selectedClassId)) || null,
    [classes, selectedClassId]
  );

  const loadTeachers = async () => {
    setTeacherLoading(true);
    try {
      const res = await teacherService.getTeachers({
        page: 1,
        limit: 200,
        search: teacherSearch || undefined,
        status: teacherStatusFilter || undefined,
        teacher_type: teacherTypeFilter || undefined
      });
      setTeachers(res.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTeacherLoading(false);
    }
  };

  const loadTeacherCatalog = async () => {
    try {
      const res = await teacherService.getTeachers({ page: 1, limit: 400 });
      setTeacherCatalog(res.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const loadClasses = async () => {
    setClassLoading(true);
    try {
      const res = await classService.getClasses({
        page: 1,
        limit: 200,
        search: classSearch || undefined,
        status: classStatusFilter || undefined,
        class_type: classTypeFilter || undefined,
        teacher_id: classTeacherFilter || undefined
      });
      setClasses(res.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setClassLoading(false);
    }
  };

  const loadCandidates = async () => {
    try {
      const res = await recruitmentService.getCandidates({ page: 1, limit: 300, status: "PASSED" });
      setCandidates(res.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const loadClassStudents = async (classId) => {
    if (!classId) return;
    setRosterLoading(true);
    try {
      const res = await classService.getClassStudents(classId, { page: 1, limit: 200 });
      setClassStudents(res.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRosterLoading(false);
    }
  };

  useEffect(() => {
    loadTeachers();
    loadClasses();
    loadTeacherCatalog();
  }, []);

  useEffect(() => {
    loadTeachers();
  }, [teacherSearch, teacherStatusFilter, teacherTypeFilter]);

  useEffect(() => {
    loadClasses();
  }, [classSearch, classStatusFilter, classTypeFilter, classTeacherFilter]);

  useEffect(() => {
    if (activeTab === "classes") {
      loadCandidates();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedClassId) {
      loadClassStudents(selectedClassId);
    } else {
      setClassStudents([]);
    }
  }, [selectedClassId]);

  const handleTeacherSubmit = async (event) => {
    event.preventDefault();
    try {
      if (editingTeacherId) {
        await teacherService.updateTeacher(editingTeacherId, teacherForm);
        toast.success("Đã cập nhật giảng viên");
      } else {
        await teacherService.createTeacher(teacherForm);
        toast.success("Đã tạo giảng viên mới");
      }
      setTeacherForm(initialTeacherForm);
      setEditingTeacherId(null);
      loadTeachers();
      loadTeacherCatalog();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleTeacherEdit = (teacher) => {
    setEditingTeacherId(teacher.id);
    setTeacherForm({
      full_name: teacher.full_name || "",
      phone: teacher.phone || "",
      email: teacher.email || "",
      teacher_type: teacher.teacher_type || "LANGUAGE",
      employment_type: teacher.employment_type || "FULL_TIME",
      status: teacher.status || "ACTIVE"
    });
  };

  const handleTeacherDelete = async (teacher) => {
    const confirmed = window.confirm(`Xóa giảng viên ${teacher.full_name}?`);
    if (!confirmed) return;
    try {
      await teacherService.deleteTeacher(teacher.id);
      toast.success("Đã xóa giảng viên");
      loadTeachers();
      loadTeacherCatalog();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleClassSubmit = async (event) => {
    event.preventDefault();
    try {
      const payload = { ...classForm, teacher_id: Number(classForm.teacher_id) };
      if (editingClassId) {
        await classService.updateClass(editingClassId, payload);
        toast.success("Đã cập nhật lớp học");
      } else {
        await classService.createClass(payload);
        toast.success("Đã tạo lớp học");
      }
      setClassForm(initialClassForm);
      setEditingClassId(null);
      loadClasses();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleClassEdit = (classItem) => {
    setEditingClassId(classItem.id);
    setClassForm({
      class_name: classItem.class_name || "",
      class_type: classItem.class_type || "LANGUAGE",
      teacher_id: classItem.teacher_id || "",
      room: classItem.room || "",
      start_date: classItem.start_date ? String(classItem.start_date).slice(0, 10) : "",
      end_date: classItem.end_date ? String(classItem.end_date).slice(0, 10) : "",
      status: classItem.status || "PENDING"
    });
  };

  const handleClassDelete = async (classItem) => {
    const confirmed = window.confirm(`Xóa lớp ${classItem.class_name}?`);
    if (!confirmed) return;
    try {
      await classService.deleteClass(classItem.id);
      toast.success("Đã xóa lớp học");
      if (Number(selectedClassId) === Number(classItem.id)) {
        setSelectedClassId(null);
      }
      loadClasses();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleStudentSubmit = async (event) => {
    event.preventDefault();
    if (!selectedClassId) return;
    try {
      const payload = {
        candidate_id: Number(studentForm.candidate_id),
        enroll_date: studentForm.enroll_date || null,
        status: studentForm.status,
        attitude_note: studentForm.attitude_note || null
      };

      if (editingStudentId) {
        await classService.updateClassStudent(selectedClassId, editingStudentId, payload);
        toast.success("Đã cập nhật học viên");
      } else {
        await classService.addClassStudent(selectedClassId, payload);
        toast.success("Đã thêm học viên");
      }

      setStudentForm(initialStudentForm);
      setEditingStudentId(null);
      loadClassStudents(selectedClassId);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleStudentEdit = (student) => {
    setEditingStudentId(student.id);
    setStudentForm({
      candidate_id: student.candidate_id,
      enroll_date: student.enroll_date ? String(student.enroll_date).slice(0, 10) : "",
      status: student.status || "STUDYING",
      attitude_note: student.attitude_note || ""
    });
  };

  const handleStudentDelete = async (student) => {
    if (!selectedClassId) return;
    const confirmed = window.confirm("Xóa học viên khỏi lớp?");
    if (!confirmed) return;
    try {
      await classService.deleteClassStudent(selectedClassId, student.id);
      toast.success("Đã xóa học viên");
      loadClassStudents(selectedClassId);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const tabs = [
    { key: "teachers", label: "Giảng viên" },
    { key: "classes", label: "Lớp học" }
  ];

  return (
    <section className="page-grid training-shell">
      <div className="training-hero">
        <div className="training-hero__left">
          <p className="training-hero__kicker">M9 - Quản lý đào tạo</p>
          <h2 className="training-hero__title">Hệ thống đào tạo nội bộ</h2>
          <p className="training-hero__subtitle">
            Theo dõi giáo viên, lớp học và danh sách học viên. Thiết kế để thao tác nhanh,
            luồng dữ liệu rõ ràng, phù hợp thực tế giáo vụ.
          </p>
          <div className="training-hero__meta">
            <span className="training-pill">Giảng viên: {totalTeachers}</span>
            <span className="training-pill training-pill--sun">Lớp học: {totalClasses}</span>
          </div>
        </div>
        <div className="training-hero__right">
          <div className="training-stat">
            <div className="training-stat__label">Đang giảng dạy</div>
            <div className="training-stat__value">
              {classes.filter((item) => item.status === "IN_PROGRESS").length}
            </div>
          </div>
          <div className="training-stat training-stat--sun">
            <div className="training-stat__label">Sắp mở</div>
            <div className="training-stat__value">
              {classes.filter((item) => item.status === "PENDING").length}
            </div>
          </div>
          <div className="training-stat training-stat--mint">
            <div className="training-stat__label">Học viên đang học</div>
            <div className="training-stat__value">{classStudents.length}</div>
          </div>
        </div>
      </div>

      <div className="surface">
        <SectionHeader
          title="Quản lý đào tạo"
          subtitle="Tạo danh mục giáo viên, lớp học và theo dõi sĩ số theo thời gian thực."
        />
        <SegmentTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "teachers" ? (
        <div className="training-grid">
          <div className="surface training-panel">
            <SectionHeader
              title={editingTeacherId ? "Chỉnh sửa giảng viên" : "Tạo giảng viên mới"}
              subtitle="Hồ sơ cơ hữu và thỉnh giảng, phân loại chuyên môn rõ ràng."
            />
            <form className="grid-form" onSubmit={handleTeacherSubmit}>
              <label>
                Họ tên
                <input
                  value={teacherForm.full_name}
                  onChange={(event) =>
                    setTeacherForm((prev) => ({ ...prev, full_name: event.target.value }))
                  }
                  placeholder="Nguyen Van A"
                  required
                />
              </label>
              <label>
                Số điện thoại
                <input
                  value={teacherForm.phone}
                  onChange={(event) =>
                    setTeacherForm((prev) => ({ ...prev, phone: event.target.value }))
                  }
                  placeholder="0900000000"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={teacherForm.email}
                  onChange={(event) =>
                    setTeacherForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="teacher@company.vn"
                />
              </label>
              <label>
                Loại giáo viên
                <select
                  value={teacherForm.teacher_type}
                  onChange={(event) =>
                    setTeacherForm((prev) => ({ ...prev, teacher_type: event.target.value }))
                  }
                >
                  <option value="LANGUAGE">Giáo viên tiếng</option>
                  <option value="SKILL">Giáo viên nghề</option>
                </select>
              </label>
              <label>
                Loại hợp đồng
                <select
                  value={teacherForm.employment_type}
                  onChange={(event) =>
                    setTeacherForm((prev) => ({ ...prev, employment_type: event.target.value }))
                  }
                >
                  <option value="FULL_TIME">Cơ hữu</option>
                  <option value="VISITING">Thỉnh giảng</option>
                </select>
              </label>
              <label>
                Trạng thái
                <select
                  value={teacherForm.status}
                  onChange={(event) =>
                    setTeacherForm((prev) => ({ ...prev, status: event.target.value }))
                  }
                >
                  <option value="ACTIVE">Đang hoạt động</option>
                  <option value="INACTIVE">Tạm dừng</option>
                </select>
              </label>
              <div className="inline-form field-span-2">
                <button type="submit" className="btn">
                  {editingTeacherId ? "Lưu cập nhật" : "Tạo mới"}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setTeacherForm(initialTeacherForm);
                    setEditingTeacherId(null);
                  }}
                >
                  Làm mới
                </button>
              </div>
            </form>
          </div>

          <div className="surface training-panel">
            <SectionHeader
              title="Danh sách giảng viên"
              subtitle="Lọc nhanh theo chuyên môn và trạng thái hoạt động."
            />
            <div className="filter-row training-filter">
              <input
                placeholder="Tìm kiếm họ tên, email, SĐT"
                value={teacherSearch}
                onChange={(event) => setTeacherSearch(event.target.value)}
              />
              <select
                value={teacherTypeFilter}
                onChange={(event) => setTeacherTypeFilter(event.target.value)}
              >
                <option value="">Tất cả chuyên môn</option>
                <option value="LANGUAGE">Tiếng</option>
                <option value="SKILL">Nghề</option>
              </select>
              <select
                value={teacherStatusFilter}
                onChange={(event) => setTeacherStatusFilter(event.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Tạm dừng</option>
              </select>
              <button type="button" className="btn ghost" onClick={loadTeachers}>
                Làm mới
              </button>
            </div>
            {teacherLoading ? <p className="muted">Đang tải dữ liệu...</p> : null}
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    <th>Chuyên môn</th>
                    <th>Loại</th>
                    <th>Liên hệ</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((teacher) => (
                    <tr key={teacher.id}>
                      <td>{teacher.full_name}</td>
                      <td>{teacherTypeLabels[teacher.teacher_type] || teacher.teacher_type}</td>
                      <td>{employmentLabels[teacher.employment_type] || teacher.employment_type}</td>
                      <td>
                        <div>{teacher.phone || "-"}</div>
                        <div className="muted">{teacher.email || "-"}</div>
                      </td>
                      <td>
                        <span className={`badge ${teacher.status === "ACTIVE" ? "" : "warn"}`}>
                          {teacher.status === "ACTIVE" ? "Hoạt động" : "Tạm dừng"}
                        </span>
                      </td>
                      <td>
                        <div className="inline-form">
                          <button
                            type="button"
                            className="btn small ghost"
                            onClick={() => handleTeacherEdit(teacher)}
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            className="btn small text danger"
                            onClick={() => handleTeacherDelete(teacher)}
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!teachers.length ? (
                    <tr>
                      <td colSpan="6">Chưa có dữ liệu giảng viên.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="training-stack">
          <div className="training-grid">
            <div className="surface training-panel">
              <SectionHeader
                title={editingClassId ? "Chỉnh sửa lớp học" : "Tạo lớp học mới"}
                subtitle="Gán giáo viên chủ nhiệm và theo dõi tiến độ giảng dạy."
              />
              <form className="grid-form" onSubmit={handleClassSubmit}>
                <label>
                  Tên lớp
                  <input
                    value={classForm.class_name}
                    onChange={(event) =>
                      setClassForm((prev) => ({ ...prev, class_name: event.target.value }))
                    }
                    placeholder="Lớp Tiếng Nhật K15"
                    required
                  />
                </label>
                <label>
                  Loại lớp
                  <select
                    value={classForm.class_type}
                    onChange={(event) =>
                      setClassForm((prev) => ({ ...prev, class_type: event.target.value }))
                    }
                  >
                    <option value="LANGUAGE">Tiếng</option>
                    <option value="SKILL">Nghề</option>
                  </select>
                </label>
                <label>
                  Giáo viên phụ trách
                  <select
                    value={classForm.teacher_id}
                    onChange={(event) =>
                      setClassForm((prev) => ({ ...prev, teacher_id: event.target.value }))
                    }
                    required
                  >
                    <option value="">Chọn giáo viên</option>
                    {teacherOptions.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {formatTeacherLabel(teacher)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Phòng học
                  <input
                    value={classForm.room}
                    onChange={(event) =>
                      setClassForm((prev) => ({ ...prev, room: event.target.value }))
                    }
                    placeholder="Phòng 302"
                  />
                </label>
                <label>
                  Bắt đầu
                  <input
                    type="date"
                    value={classForm.start_date}
                    onChange={(event) =>
                      setClassForm((prev) => ({ ...prev, start_date: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Kết thúc
                  <input
                    type="date"
                    value={classForm.end_date}
                    onChange={(event) =>
                      setClassForm((prev) => ({ ...prev, end_date: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Trạng thái
                  <select
                    value={classForm.status}
                    onChange={(event) =>
                      setClassForm((prev) => ({ ...prev, status: event.target.value }))
                    }
                  >
                    <option value="PENDING">Sắp mở</option>
                    <option value="IN_PROGRESS">Đang giảng dạy</option>
                    <option value="COMPLETED">Đã kết thúc</option>
                  </select>
                </label>
                <div className="inline-form field-span-2">
                  <button type="submit" className="btn">
                    {editingClassId ? "Lưu cập nhật" : "Tạo lớp"}
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => {
                      setClassForm(initialClassForm);
                      setEditingClassId(null);
                    }}
                  >
                    Làm mới
                  </button>
                </div>
              </form>
            </div>

            <div className="surface training-panel">
              <SectionHeader
                title="Danh sách lớp học"
                subtitle="Theo dõi nhanh các lớp đang mở và lớp đã hoàn thành."
              />
              <div className="filter-row training-filter">
                <input
                  placeholder="Tìm tên lớp / giáo viên"
                  value={classSearch}
                  onChange={(event) => setClassSearch(event.target.value)}
                />
                <select
                  value={classTypeFilter}
                  onChange={(event) => setClassTypeFilter(event.target.value)}
                >
                  <option value="">Tất cả loại</option>
                  <option value="LANGUAGE">Tiếng</option>
                  <option value="SKILL">Nghề</option>
                </select>
                <select
                  value={classStatusFilter}
                  onChange={(event) => setClassStatusFilter(event.target.value)}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="PENDING">Sắp mở</option>
                  <option value="IN_PROGRESS">Đang giảng dạy</option>
                  <option value="COMPLETED">Đã kết thúc</option>
                </select>
                <button type="button" className="btn ghost" onClick={loadClasses}>
                  Làm mới
                </button>
              </div>
              <div className="filter-row training-filter training-filter--compact">
                <select
                  value={classTeacherFilter}
                  onChange={(event) => setClassTeacherFilter(event.target.value)}
                >
                  <option value="">Tất cả giáo viên</option>
                  {teacherOptions.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {formatTeacherLabel(teacher)}
                    </option>
                  ))}
                </select>
                <div></div>
                <div></div>
                <div></div>
              </div>
              {classLoading ? <p className="muted">Đang tải dữ liệu...</p> : null}
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tên lớp</th>
                      <th>Loại</th>
                      <th>Giáo viên</th>
                      <th>Phòng</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((classItem) => (
                      <tr key={classItem.id}>
                        <td>
                          <div>{classItem.class_name}</div>
                          <div className="muted">
                            {classItem.start_date ? String(classItem.start_date).slice(0, 10) : "-"} -
                            {" "}
                            {classItem.end_date ? String(classItem.end_date).slice(0, 10) : "-"}
                          </div>
                        </td>
                        <td>
                          <span className="badge">
                            {classItem.class_type === "LANGUAGE" ? "Tiếng" : "Nghề"}
                          </span>
                        </td>
                        <td>{classItem.teacher_name || "-"}</td>
                        <td>{classItem.room || "-"}</td>
                        <td>
                          <span className="badge warn">
                            {classStatusLabels[classItem.status] || classItem.status}
                          </span>
                        </td>
                        <td>
                          <div className="inline-form">
                            <button
                              type="button"
                              className="btn small ghost"
                              onClick={() => handleClassEdit(classItem)}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="btn small ghost"
                              onClick={() => setSelectedClassId(classItem.id)}
                            >
                                Sĩ số
                            </button>
                            <button
                              type="button"
                              className="btn small text danger"
                              onClick={() => handleClassDelete(classItem)}
                            >
                                Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!classes.length ? (
                      <tr>
                          <td colSpan="6">Chưa có lớp học nào.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="surface training-panel">
            <SectionHeader
                title="Xếp lớp và theo dõi sĩ số"
                subtitle="Thêm học viên từ danh sách đã trúng tuyển, cập nhật điểm trung bình và thái độ."
            />
            <div className="training-roster">
              <div className="training-roster__form">
                <div className="training-roster__header">
                    <strong>Lớp đang chọn:</strong>{" "}
                    <span>{selectedClass ? selectedClass.class_name : "Chưa chọn"}</span>
                </div>
                <form className="grid-form" onSubmit={handleStudentSubmit}>
                  <label>
                      Ứng viên
                    <select
                      value={studentForm.candidate_id}
                      onChange={(event) =>
                        setStudentForm((prev) => ({ ...prev, candidate_id: event.target.value }))
                      }
                      disabled={!selectedClassId}
                      required
                    >
                      <option value="">Chọn ứng viên (PASSED)</option>
                      {candidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.full_name} - {candidate.citizen_id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Ngày vào lớp
                    <input
                      type="date"
                      value={studentForm.enroll_date}
                      onChange={(event) =>
                        setStudentForm((prev) => ({ ...prev, enroll_date: event.target.value }))
                      }
                      disabled={!selectedClassId}
                    />
                  </label>
                  <label>
                    Trạng thái
                    <select
                      value={studentForm.status}
                      onChange={(event) =>
                        setStudentForm((prev) => ({ ...prev, status: event.target.value }))
                      }
                      disabled={!selectedClassId}
                    >
                      <option value="STUDYING">Đang học</option>
                      <option value="DROPPED">Bỏ học</option>
                      <option value="GRADUATED">Tốt nghiệp</option>
                    </select>
                  </label>
                  <label className="field-span-2">
                    Ghi chú thái độ
                    <textarea
                      rows="2"
                      value={studentForm.attitude_note}
                      onChange={(event) =>
                        setStudentForm((prev) => ({ ...prev, attitude_note: event.target.value }))
                      }
                      disabled={!selectedClassId}
                    />
                  </label>
                  <div className="inline-form field-span-2">
                    <button type="submit" className="btn" disabled={!selectedClassId}>
                      {editingStudentId ? "Lưu cập nhật" : "Thêm học viên"}
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => {
                        setStudentForm(initialStudentForm);
                        setEditingStudentId(null);
                      }}
                      disabled={!selectedClassId}
                    >
                      Làm mới
                    </button>
                  </div>
                </form>
              </div>
              <div className="training-roster__list">
                <div className="training-roster__header">
                  <strong>Danh sách học viên</strong>
                  {selectedClass ? (
                    <span className="training-pill training-pill--sun">
                      {classStudents.length} học viên
                    </span>
                  ) : null}
                </div>
                {rosterLoading ? <p className="muted">Đang tải danh sách...</p> : null}
                <div className="table-wrap compact-table">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Ứng viên</th>
                        <th>Trạng thái</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classStudents.map((student) => (
                        <tr key={student.id}>
                          <td>
                            <div>{student.candidate_name}</div>
                            <div className="muted">{student.candidate_citizen_id}</div>
                          </td>
                          <td>
                            <span className="badge">
                              {studentStatusLabels[student.status] || student.status}
                            </span>
                          </td>
                          <td>
                            <div className="inline-form">
                              <button
                                type="button"
                                className="btn small ghost"
                                onClick={() => handleStudentEdit(student)}
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                className="btn small text danger"
                                onClick={() => handleStudentDelete(student)}
                              >
                                Xóa
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!selectedClassId ? (
                        <tr>
                          <td colSpan="4">Chọn lớp để xem danh sách học viên.</td>
                        </tr>
                      ) : null}
                      {selectedClassId && !classStudents.length ? (
                        <tr>
                          <td colSpan="4">Lớp này chưa có học viên.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Module9TrainingPage;
