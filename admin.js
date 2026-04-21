// 관리자 관련 JavaScript

let currentAdminMonth = new Date().getMonth() + 1;
let currentAdminYear = new Date().getFullYear();
let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth(); // 0-indexed

document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('admin-login.html')) {
        if (sessionStorage.getItem('adminLoggedIn') === 'true') {
            window.location.href = 'admin.html';
        }
    }
    if (window.location.pathname.includes('admin.html')) {
        if (sessionStorage.getItem('adminLoggedIn') !== 'true') {
            window.location.href = 'admin-login.html';
            return;
        }
        initializeAdminDashboard();
    }
});

function loginAdmin() {
    const password = document.getElementById('adminPassword').value;
    const savedPassword = Storage.load('admin_password');
    if (password === savedPassword) {
        sessionStorage.setItem('adminLoggedIn', 'true');
        window.location.href = 'admin.html';
    } else {
        alert('비밀번호가 일치하지 않습니다.');
    }
}

function goBack() { window.location.href = 'index.html'; }
function logoutAdmin() {
    sessionStorage.removeItem('adminLoggedIn');
    window.location.href = 'index.html';
}

function initializeAdminDashboard() {
    loadDashboardStats();
    loadTeachersList();
    loadPayrollSummary();
    loadLogs();
    loadHolidays();
    updateAdminMonthDisplay();
    showSection('dashboard');
}

// ============================================================
// 섹션 전환
// ============================================================
function showSection(sectionName) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    document.getElementById(sectionName + 'Section').classList.add('active');
    if (event && event.target) {
        const link = event.target.closest('a');
        if (link) link.classList.add('active');
    }
    const titles = {
        dashboard: '관리자 대시보드', teachers: '선생님 관리',
        payroll: '급여 계산', logs: '출석 로그', holidays: '휴원일 설정'
    };
    document.getElementById('sectionTitle').textContent = titles[sectionName] || '';
}

// ============================================================
// 대시보드
// ============================================================
function loadDashboardStats() {
    const teachers = Storage.load('teachers') || [];
    const workLogs = Storage.load('work_logs') || [];
    document.getElementById('totalTeachers').textContent = teachers.length + '명';

    const now = new Date();
    const monthRange = DateUtils.getMonthRange(now.getFullYear(), now.getMonth() + 1);
    const holidays = Storage.load('holidays') || [];
    let workDays = 0, totalSalary = 0;

    for (let d = new Date(monthRange.start); d <= new Date(monthRange.end); d.setDate(d.getDate() + 1)) {
        const ds = d.toISOString().split('T')[0];
        if (DateUtils.isWeekday(ds) && !holidays.some(h => h.date === ds)) workDays++;
    }
    document.getElementById('totalWorkDays').textContent = workDays + '일';

    teachers.forEach(t => {
        const logs = workLogs.filter(l => l.teacher_id == t.id && l.work_date >= monthRange.start && l.work_date <= monthRange.end);
        let mins = 0;
        logs.forEach(l => {
            if (l.check_in_time && l.arrival_time) {
                mins += PayrollCalculator.calculateWorkMinutes(PayrollCalculator.adjustCheckInTime(l.check_in_time, l.first_bus_time), l.arrival_time);
            }
        });
        totalSalary += PayrollCalculator.calculateSalary(mins, t.hourly_rate);
    });
    document.getElementById('totalSalary').textContent = totalSalary.toLocaleString() + '원';
    updateCharts();
}

function updateCharts() {
    const teachers = Storage.load('teachers') || [];
    const workLogs = Storage.load('work_logs') || [];

    function calcMins(teacherId) {
        let mins = 0;
        workLogs.filter(l => l.teacher_id == teacherId && isCurrentMonth(l.work_date)).forEach(l => {
            if (l.check_in_time && l.arrival_time)
                mins += PayrollCalculator.calculateWorkMinutes(PayrollCalculator.adjustCheckInTime(l.check_in_time, l.first_bus_time), l.arrival_time);
        });
        return mins;
    }

    createOrUpdateChart('workChart', teachers.map(t => ({ teacher: t.name, hours: Math.round(calcMins(t.id) / 60 * 10) / 10 })), 'bar', '근무시간 (시간)');
    createOrUpdateChart('salaryChart', teachers.map(t => ({ teacher: t.name, salary: PayrollCalculator.calculateSalary(calcMins(t.id), t.hourly_rate) })), 'bar', '급여 (원)');
}

function createOrUpdateChart(canvasId, data, type, label) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (window[canvasId + 'Chart']) window[canvasId + 'Chart'].destroy();
    window[canvasId + 'Chart'] = new Chart(canvas.getContext('2d'), {
        type,
        data: {
            labels: data.map(d => d.teacher),
            datasets: [{ label, data: data.map(d => label.includes('시간') ? d.hours : d.salary), backgroundColor: 'rgba(141,113,94,0.8)', borderColor: 'rgba(141,113,94,1)', borderWidth: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}

function isCurrentMonth(dateStr) {
    const d = new Date(dateStr), now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

// ============================================================
// 선생님 관리
// ============================================================
function loadTeachersList() {
    const teachers = Storage.load('teachers') || [];
    const tbody = document.getElementById('teachersTableBody');
    if (!teachers.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;">등록된 선생님이 없습니다.</td></tr>';
        return;
    }
    tbody.innerHTML = teachers.map(t => `
        <tr>
            <td>${t.name}</td>
            <td>${t.phone || '-'}</td>
            <td>${t.start_date}</td>
            <td>${(t.hourly_rate || 0).toLocaleString()}원</td>
            <td>
                <button onclick="showEditTeacherModal(${t.id})" class="btn-secondary" style="padding:6px 12px;font-size:0.8rem;">
                    <span class="material-symbols-outlined" style="font-size:1rem;">edit</span>
                </button>
                <button onclick="deleteTeacher(${t.id})" class="btn-secondary" style="padding:6px 12px;font-size:0.8rem;margin-left:5px;">
                    <span class="material-symbols-outlined" style="font-size:1rem;">delete</span>
                </button>
            </td>
        </tr>`).join('');
}

function showAddTeacherModal() {
    document.getElementById('addTeacherForm').reset();
    document.getElementById('addTeacherModal').classList.add('show');
}

function addTeacher(event) {
    event.preventDefault();
    const teachers = Storage.load('teachers') || [];
    teachers.push({
        id: Date.now(),
        name: document.getElementById('teacherName').value.trim(),
        phone: document.getElementById('teacherPhone').value.trim(),
        start_date: document.getElementById('startDate').value,
        hourly_rate: parseInt(document.getElementById('hourlyRate').value)
    });
    if (Storage.save('teachers', teachers)) {
        closeModal('addTeacherModal');
        loadTeachersList();
        loadDashboardStats();
        alert('선생님이 추가되었습니다.');
    } else { alert('저장에 실패했습니다.'); }
}

function showEditTeacherModal(teacherId) {
    const teachers = Storage.load('teachers') || [];
    const t = teachers.find(t => t.id == teacherId);
    if (!t) return;
    document.getElementById('editTeacherId').value = t.id;
    document.getElementById('editTeacherName').value = t.name || '';
    document.getElementById('editTeacherPhone').value = t.phone || '';
    document.getElementById('editStartDate').value = t.start_date || '';
    document.getElementById('editHourlyRate').value = t.hourly_rate || '';
    document.getElementById('editTeacherModal').classList.add('show');
}

function saveEditTeacher(event) {
    event.preventDefault();
    const id = parseInt(document.getElementById('editTeacherId').value);
    const name = document.getElementById('editTeacherName').value.trim();
    const phone = document.getElementById('editTeacherPhone').value.trim();
    const startDate = document.getElementById('editStartDate').value;
    const hourlyRate = parseInt(document.getElementById('editHourlyRate').value);
    if (!name || !startDate || isNaN(hourlyRate)) { alert('모든 필수 항목을 입력해주세요.'); return; }
    let teachers = Storage.load('teachers') || [];
    const idx = teachers.findIndex(t => t.id === id);
    if (idx === -1) { alert('선생님을 찾을 수 없습니다.'); return; }
    teachers[idx] = { ...teachers[idx], name, phone, start_date: startDate, hourly_rate: hourlyRate };
    if (Storage.save('teachers', teachers)) {
        closeModal('editTeacherModal');
        loadTeachersList();
        loadDashboardStats();
        alert('선생님 정보가 수정되었습니다.');
    } else { alert('저장에 실패했습니다.'); }
}

function deleteTeacher(teacherId) {
    if (!confirm('정말로 이 선생님을 삭제하시겠습니까?')) return;
    let teachers = Storage.load('teachers') || [];
    teachers = teachers.filter(t => t.id !== teacherId);
    if (Storage.save('teachers', teachers)) { loadTeachersList(); loadDashboardStats(); alert('선생님이 삭제되었습니다.'); }
    else alert('삭제에 실패했습니다.');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// ============================================================
// 급여
// ============================================================
function changeAdminMonth(direction) {
    currentAdminMonth += direction;
    if (currentAdminMonth > 12) { currentAdminMonth = 1; currentAdminYear++; }
    else if (currentAdminMonth < 1) { currentAdminMonth = 12; currentAdminYear--; }
    updateAdminMonthDisplay();
    loadPayrollSummary();
}

function updateAdminMonthDisplay() {
    document.getElementById('adminCurrentMonth').textContent = `${currentAdminYear}년 ${currentAdminMonth}월`;
}

function loadPayrollSummary() {
    const teachers = Storage.load('teachers') || [];
    const workLogs = Storage.load('work_logs') || [];
    const monthRange = DateUtils.getMonthRange(currentAdminYear, currentAdminMonth);
    let html = '<div class="payroll-grid">';
    teachers.forEach(t => {
        const logs = workLogs.filter(l => l.teacher_id == t.id && l.work_date >= monthRange.start && l.work_date <= monthRange.end);
        let mins = 0, days = 0;
        logs.forEach(l => { if (l.check_in_time && l.arrival_time) { mins += PayrollCalculator.calculateWorkMinutes(PayrollCalculator.adjustCheckInTime(l.check_in_time, l.first_bus_time), l.arrival_time); days++; } });
        html += `<div class="payroll-card"><h4>${t.name}</h4><div class="payroll-info"><p><strong>근무일수:</strong> ${days}일</p><p><strong>총 근무시간:</strong> ${DateUtils.minsToHHMM(mins)}</p><p><strong>급여:</strong> ${PayrollCalculator.calculateSalary(mins,t.hourly_rate).toLocaleString()}원</p></div></div>`;
    });
    html += '</div>';
    document.getElementById('payrollSummary').innerHTML = html;
}

function calculateAllSalaries() { loadPayrollSummary(); alert('급여 계산이 완료되었습니다.'); }

function downloadExcel() {
    const teachers = Storage.load('teachers') || [];
    const workLogs = Storage.load('work_logs') || [];
    const monthRange = DateUtils.getMonthRange(currentAdminYear, currentAdminMonth);
    let csv = '선생님,근무일수,총근무시간,급여\n';
    teachers.forEach(t => {
        const logs = workLogs.filter(l => l.teacher_id == t.id && l.work_date >= monthRange.start && l.work_date <= monthRange.end);
        let mins = 0, days = 0;
        logs.forEach(l => { if (l.check_in_time && l.arrival_time) { mins += PayrollCalculator.calculateWorkMinutes(PayrollCalculator.adjustCheckInTime(l.check_in_time, l.first_bus_time), l.arrival_time); days++; } });
        csv += `${t.name},${days},${DateUtils.minsToHHMM(mins)},${PayrollCalculator.calculateSalary(mins,t.hourly_rate)}\n`;
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'}));
    link.download = `급여내역_${currentAdminYear}년${currentAdminMonth}월.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ============================================================
// 출석 로그
// ============================================================
function loadLogs() {
    const teachers = Storage.load('teachers') || [];
    const tf = document.getElementById('teacherFilter');
    tf.innerHTML = '<option value="">전체 선생님</option>' + teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    document.getElementById('monthFilter').value = new Date().toISOString().slice(0,7);
    filterLogs();
}

function filterLogs() {
    const tid = document.getElementById('teacherFilter').value;
    const month = document.getElementById('monthFilter').value;
    const teachers = Storage.load('teachers') || [];
    let logs = Storage.load('work_logs') || [];
    if (tid) logs = logs.filter(l => l.teacher_id == tid);
    if (month) logs = logs.filter(l => l.work_date.startsWith(month));
    logs.sort((a,b) => new Date(b.work_date)-new Date(a.work_date));
    const tbody = document.getElementById('logsTableBody');
    if (!logs.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;">조회된 로그가 없습니다.</td></tr>'; return; }
    tbody.innerHTML = logs.map(l => {
        const t = teachers.find(t => t.id == l.teacher_id);
        let wh = '-';
        if (l.check_in_time && l.arrival_time) {
            const mins = PayrollCalculator.calculateWorkMinutes(PayrollCalculator.adjustCheckInTime(l.check_in_time, l.first_bus_time), l.arrival_time);
            wh = DateUtils.minsToHHMM(mins);
        }
        return `<tr><td>${l.work_date}</td><td>${t?t.name:'알 수 없음'}</td><td>${l.check_in_time||'-'}</td><td>${l.first_bus_time||'-'}</td><td>${l.last_dropoff_time||'-'}</td><td>${l.arrival_time||'-'}</td><td>${wh}</td></tr>`;
    }).join('');
}

// ============================================================
// 휴원일 관리 - 캘린더 UI
// ============================================================
function loadHolidays() { renderHolidaysTable(); }

function showAddHolidayModal() {
    calendarYear = new Date().getFullYear();
    calendarMonth = new Date().getMonth();
    renderCalendar();
    document.getElementById('addHolidayModal').classList.add('show');
}

function getTypeLabel(type) {
    return { school_holiday:'휴원', public_holiday:'공휴일', vacation:'방학', event:'행사' }[type] || '휴원';
}

function renderCalendar() {
    const holidays = Storage.load('holidays') || [];
    const monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    const dayNames = ['일','월','화','수','목','금','토'];
    document.getElementById('calendarMonthTitle').textContent = `${calendarYear}년 ${monthNames[calendarMonth]}`;

    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth+1, 0).getDate();
    const today = new Date().toISOString().split('T')[0];

    let html = dayNames.map((d,i) => `<div class="cal-header ${i===0?'sunday':i===6?'saturday':''}">${d}</div>`).join('');
    for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';

    for (let day = 1; day <= daysInMonth; day++) {
        const ds = `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const dow = new Date(calendarYear, calendarMonth, day).getDay();
        const isWeekend = dow===0||dow===6;
        const h = holidays.find(h => h.date===ds);
        const classes = ['cal-day', isWeekend?(dow===0?'sunday':'saturday'):'', h?'is-holiday':'', ds===today?'is-today':''].filter(Boolean).join(' ');
        html += `<div class="${classes}" onclick="toggleHolidayDate('${ds}')" title="${h?h.description||getTypeLabel(h.type):'클릭하여 휴원일 추가'}">
            <span class="cal-day-num">${day}</span>
            ${h?`<span class="cal-holiday-badge">${getTypeLabel(h.type)}</span>`:''}
        </div>`;
    }
    document.getElementById('calendarGrid').innerHTML = html;
}

function changeCalendarMonth(dir) {
    calendarMonth += dir;
    if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
    else if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
    const inlineForm = document.getElementById('inlineHolidayForm');
    if (inlineForm) inlineForm.remove();
    renderCalendar();
}

function toggleHolidayDate(dateStr) {
    const holidays = Storage.load('holidays') || [];
    if (holidays.find(h => h.date===dateStr)) {
        if (!confirm(`${dateStr} 휴원일을 삭제하시겠습니까?`)) return;
        Storage.save('holidays', holidays.filter(h => h.date!==dateStr));
        renderCalendar();
        renderHolidaysTable();
        return;
    }
    showInlineHolidayForm(dateStr);
}

function showInlineHolidayForm(dateStr) {
    const existing = document.getElementById('inlineHolidayForm');
    if (existing) existing.remove();
    const form = document.createElement('div');
    form.id = 'inlineHolidayForm';
    form.className = 'inline-holiday-form';
    form.innerHTML = `
        <div class="inline-form-header">📅 <strong>${dateStr}</strong> 휴원일 추가</div>
        <div class="inline-form-row">
            <select id="inlineHolidayType">
                <option value="school_holiday">휴원</option>
                <option value="public_holiday">공휴일</option>
                <option value="vacation">방학</option>
                <option value="event">행사</option>
            </select>
            <input type="text" id="inlineHolidayDesc" placeholder="설명 (예: 추석, 정기휴원)">
        </div>
        <div class="inline-form-actions">
            <button onclick="confirmAddHoliday('${dateStr}')" class="btn-primary" style="padding:7px 20px;font-size:0.85rem;">추가</button>
            <button onclick="document.getElementById('inlineHolidayForm').remove()" class="btn-secondary" style="padding:7px 20px;font-size:0.85rem;">취소</button>
        </div>`;
    document.getElementById('calendarContainer').appendChild(form);
    document.getElementById('inlineHolidayDesc').focus();
}

function confirmAddHoliday(dateStr) {
    const type = document.getElementById('inlineHolidayType').value;
    const description = document.getElementById('inlineHolidayDesc').value.trim();
    const holidays = Storage.load('holidays') || [];
    if (holidays.some(h => h.date===dateStr)) { alert('이미 등록된 날짜입니다.'); return; }
    holidays.push({date:dateStr, type, description});
    holidays.sort((a,b) => a.date.localeCompare(b.date));
    Storage.save('holidays', holidays);
    document.getElementById('inlineHolidayForm').remove();
    renderCalendar();
    renderHolidaysTable();
}

function deleteHoliday(dateStr) {
    if (!confirm('이 휴원일을 삭제하시겠습니까?')) return;
    Storage.save('holidays', (Storage.load('holidays')||[]).filter(h => h.date!==dateStr));
    renderCalendar();
    renderHolidaysTable();
}

function renderHolidaysTable() {
    const holidays = Storage.load('holidays') || [];
    const tbody = document.getElementById('holidaysTableBody');
    const dayNames = ['일','월','화','수','목','금','토'];
    if (!holidays.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;">등록된 휴원일이 없습니다.</td></tr>'; return; }
    tbody.innerHTML = holidays.map(h => `
        <tr>
            <td>${h.date}</td>
            <td>${dayNames[new Date(h.date).getDay()]}</td>
            <td>${getTypeLabel(h.type)}</td>
            <td>${h.description||'-'}</td>
            <td><button onclick="deleteHoliday('${h.date}')" class="btn-secondary" style="padding:6px 12px;font-size:0.8rem;"><span class="material-symbols-outlined" style="font-size:1rem;">delete</span></button></td>
        </tr>`).join('');
}
