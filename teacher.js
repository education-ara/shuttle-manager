// 선생님 관련 JavaScript

let currentTeacherId = null;
let currentMonth = new Date().getMonth() + 1;
let currentYear = new Date().getFullYear();

// ============================================================
// 페이지 초기화
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
    const urlParams = new URLSearchParams(window.location.search);

    if (window.location.pathname.includes('teacher-select.html')) {
        loadTeachers();
    }

    if (window.location.pathname.includes('teacher.html')) {
        currentTeacherId = urlParams.get('teacherId');
        if (!currentTeacherId) {
            alert('선생님을 선택해주세요.');
            window.location.href = 'teacher-select.html';
            return;
        }
        loadTeacherInfo();
        loadWorkLogs();
    }
});

// ============================================================
// 선생님 선택 페이지
// ============================================================
function loadTeachers() {
    const teachers = Storage.load('teachers') || [];
    const teacherGrid = document.getElementById('teacherGrid');

    if (teachers.length === 0) {
        teacherGrid.innerHTML = '<p style="text-align:center;color:#888;padding:40px;">등록된 선생님이 없습니다.</p>';
        return;
    }

    teacherGrid.innerHTML = teachers.map(teacher => `
        <div class="teacher-card" onclick="selectTeacher(${teacher.id})">
            <div class="teacher-avatar">${teacher.name.charAt(0)}</div>
            <div class="teacher-name">${teacher.name}</div>
        </div>
    `).join('');
}

function selectTeacher(teacherId) {
    window.location.href = `teacher.html?teacherId=${teacherId}`;
}

// ============================================================
// 근무일지 페이지
// ============================================================
function loadTeacherInfo() {
    const teachers = Storage.load('teachers') || [];
    const teacher = teachers.find(t => t.id == currentTeacherId);

    if (!teacher) {
        alert('선생님 정보를 찾을 수 없습니다.');
        window.location.href = 'teacher-select.html';
        return;
    }

    document.getElementById('teacherName').textContent = teacher.name;
    updateMonthDisplay();
}

function updateMonthDisplay() {
    document.getElementById('currentMonth').textContent = `${currentYear}년 ${currentMonth}월`;
}

function changeMonth(direction) {
    currentMonth += direction;
    if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    else if (currentMonth < 1) { currentMonth = 12; currentYear--; }
    updateMonthDisplay();
    loadWorkLogs();
}

// ============================================================
// 근무일지 로드 및 렌더링
// ============================================================
function loadWorkLogs() {
    const workLogs = Storage.load('work_logs') || [];
    const holidays = Storage.load('holidays') || [];
    const tbody = document.getElementById('workLogsBody');

    // 해당 월 1일~말일 (로컬 타임존 기준)
    const monthRange = DateUtils.getMonthRange(currentYear, currentMonth);
    const [sy, sm, sd] = monthRange.start.split('-').map(Number);
    const [ey, em, ed] = monthRange.end.split('-').map(Number);
    const startDate = new Date(sy, sm - 1, sd);
    const endDate = new Date(ey, em - 1, ed);

    let actualWorkDays = 0;
    let totalWorkableDays = 0;
    let html = '';

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = DateUtils.toLocalDateStr(d);
        const dayOfWeek = d.getDay();
        const dayName = ['일', '월', '화', '수', '목', '금', '토'][dayOfWeek];
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isToday = dateStr === DateUtils.today();

        // 관리자가 설정한 휴원일인지 확인
        const schoolHoliday = holidays.find(h => h.date === dateStr);
        const isSchoolHoliday = !!schoolHoliday;

        // 해당 날짜의 근무 기록
        const workLog = workLogs.find(l =>
            l.teacher_id == currentTeacherId && l.work_date === dateStr
        );

        // 선생님이 수동으로 휴일 지정한 경우
        const isManualHoliday = !!(workLog && workLog.work_type === 'holiday');

        // 최종 휴일 여부 (주말 OR 휴원일 OR 수동 지정)
        const isHoliday = isWeekend || isSchoolHoliday || isManualHoliday;

        // 근무 통계 (평일 + 휴원일 아닌 날)
        if (!isWeekend && !isSchoolHoliday) {
            totalWorkableDays++;
            if (!isManualHoliday && workLog && isWorkLogComplete(workLog)) {
                actualWorkDays++;
            }
        }

        // 행 CSS 클래스
        const rowClasses = [
            isHoliday ? 'weekend' : '',
            isToday ? 'today' : '',
            !isHoliday && workLog && isWorkLogComplete(workLog) ? 'completed' : '',
            !isHoliday && !isManualHoliday && !workLog ? 'missing-data' : ''
        ].filter(Boolean).join(' ');

        // 구분 셀: 주말/휴원일은 select 비활성화, 수동 근무/휴일만 변경 가능
        const selectDisabled = isWeekend || isSchoolHoliday;
        let selectCell;
        if (isWeekend) {
            selectCell = `<span style="font-size:0.82rem;color:#aaa;">주말</span>`;
        } else if (isSchoolHoliday) {
            selectCell = `<span style="font-size:0.82rem;color:#e53935;" title="${schoolHoliday.description || ''}">휴원일${schoolHoliday.description ? ': ' + schoolHoliday.description : ''}</span>`;
        } else {
            const isCurrentlyHoliday = isManualHoliday;
            selectCell = `
                <select onchange="saveWorkLog('${dateStr}', 'work_type', this.value)" style="font-size:0.8rem;">
                    <option value="work" ${!isCurrentlyHoliday ? 'selected' : ''}>근무</option>
                    <option value="holiday" ${isCurrentlyHoliday ? 'selected' : ''}>휴일</option>
                </select>`;
        }

        // 상태 배지
        let statusClass, statusText;
        if (isWeekend) {
            statusClass = 'status-weekend'; statusText = '주말';
        } else if (isSchoolHoliday) {
            statusClass = 'status-school-holiday'; statusText = '휴원';
        } else if (isManualHoliday) {
            statusClass = 'status-weekend'; statusText = '휴일';
        } else if (workLog && isWorkLogComplete(workLog)) {
            statusClass = 'status-completed'; statusText = '완료';
        } else {
            statusClass = 'status-incomplete'; statusText = '미완료';
        }

        html += `
            <tr class="${rowClasses}" data-date="${dateStr}" data-is-school-holiday="${isSchoolHoliday}" data-is-weekend="${isWeekend}">
                <td>${dateStr.split('-')[2]}</td>
                <td class="${dayOfWeek === 0 ? 'day-sun' : dayOfWeek === 6 ? 'day-sat' : ''}">${dayName}</td>
                <td><input type="time" value="${workLog?.check_in_time || ''}"
                    onchange="saveWorkLog('${dateStr}', 'check_in_time', this.value)"
                    ${isHoliday ? 'disabled' : ''}></td>
                <td><input type="time" value="${workLog?.first_bus_time || ''}"
                    onchange="saveWorkLog('${dateStr}', 'first_bus_time', this.value)"
                    ${isHoliday ? 'disabled' : ''}></td>
                <td><input type="time" value="${workLog?.last_dropoff_time || ''}"
                    onchange="saveWorkLog('${dateStr}', 'last_dropoff_time', this.value)"
                    ${isHoliday ? 'disabled' : ''}></td>
                <td><input type="time" value="${workLog?.arrival_time || ''}"
                    onchange="saveWorkLog('${dateStr}', 'arrival_time', this.value)"
                    ${isHoliday ? 'disabled' : ''}></td>
                <td><input type="text" value="${workLog?.memo || ''}"
                    onchange="saveWorkLog('${dateStr}', 'memo', this.value)"
                    placeholder="메모"
                    ${isHoliday ? 'disabled' : ''}></td>
                <td>${selectCell}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            </tr>`;
    }

    tbody.innerHTML = html;
    updateWorkStats(actualWorkDays, totalWorkableDays);
}

// ============================================================
// 근무 통계
// ============================================================
function updateWorkStats(actualWorkDays, totalWorkableDays) {
    document.getElementById('actualWorkDays').textContent = actualWorkDays + '일';
    document.getElementById('totalWorkDays').textContent = totalWorkableDays + '일';

    const rate = totalWorkableDays > 0 ? Math.round((actualWorkDays / totalWorkableDays) * 100) : 0;
    const el = document.getElementById('completionRate');
    el.textContent = rate + '%';
    el.style.color = rate >= 80 ? 'var(--success-color)' : rate >= 60 ? 'var(--warning-color)' : 'var(--error-color)';
}

// ============================================================
// 근무일지 완성 여부
// ============================================================
function isWorkLogComplete(workLog) {
    return !!(workLog.check_in_time && workLog.first_bus_time &&
              workLog.last_dropoff_time && workLog.arrival_time);
}

// ============================================================
// 근무일지 저장
// ============================================================
function saveWorkLog(date, field, value) {
    if (!currentTeacherId) return;

    let workLogs = Storage.load('work_logs') || [];
    let workLog = workLogs.find(l => l.teacher_id == currentTeacherId && l.work_date === date);

    if (!workLog) {
        workLog = {
            id: Date.now() + Math.random(),
            teacher_id: currentTeacherId,
            work_date: date,
            check_in_time: '',
            first_bus_time: '',
            last_dropoff_time: '',
            arrival_time: '',
            memo: '',
            work_type: 'work',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        workLogs.push(workLog);
    }

    workLog[field] = value;
    workLog.updated_at = new Date().toISOString();

    // 휴일로 변경 시 시간 필드 초기화
    if (field === 'work_type' && value === 'holiday') {
        workLog.check_in_time = '';
        workLog.first_bus_time = '';
        workLog.last_dropoff_time = '';
        workLog.arrival_time = '';
    }

    if (Storage.save('work_logs', workLogs)) {
        // 저장 후 해당 행 UI 즉시 갱신
        updateRowUI(date, workLog);
        // 통계 재계산
        recalculateStats();
        showAutosaveNotification();
    } else {
        alert('저장에 실패했습니다. 다시 시도해주세요.');
    }
}

// ============================================================
// 저장 후 개별 행 UI 업데이트 (전체 재렌더링 없이)
// ============================================================
function updateRowUI(date, workLog) {
    const row = document.querySelector(`tr[data-date="${date}"]`);
    if (!row) return;

    const isWeekend = row.dataset.isWeekend === 'true';
    const isSchoolHoliday = row.dataset.isSchoolHoliday === 'true';
    const isManualHoliday = workLog.work_type === 'holiday';
    const isHoliday = isWeekend || isSchoolHoliday || isManualHoliday;
    const isComplete = isWorkLogComplete(workLog);

    // 행 클래스 갱신
    row.className = [
        isHoliday ? 'weekend' : '',
        date === DateUtils.today() ? 'today' : '',
        !isHoliday && isComplete ? 'completed' : '',
        !isHoliday && !isManualHoliday && !isComplete ? 'missing-data' : ''
    ].filter(Boolean).join(' ');

    // 입력 필드 활성/비활성
    row.querySelectorAll('input[type="time"], input[type="text"]').forEach(inp => {
        inp.disabled = isHoliday;
        if (isManualHoliday && inp.type === 'time') inp.value = '';
    });

    // 상태 배지 갱신
    const badge = row.querySelector('.status-badge');
    if (badge) {
        let cls, txt;
        if (isWeekend) { cls = 'status-weekend'; txt = '주말'; }
        else if (isSchoolHoliday) { cls = 'status-school-holiday'; txt = '휴원'; }
        else if (isManualHoliday) { cls = 'status-weekend'; txt = '휴일'; }
        else if (isComplete) { cls = 'status-completed'; txt = '완료'; }
        else { cls = 'status-incomplete'; txt = '미완료'; }
        badge.className = `status-badge ${cls}`;
        badge.textContent = txt;
    }
}

// ============================================================
// 통계 재계산 (전체 재렌더링 없이)
// ============================================================
function recalculateStats() {
    const workLogs = Storage.load('work_logs') || [];
    const holidays = Storage.load('holidays') || [];
    const monthRange = DateUtils.getMonthRange(currentYear, currentMonth);
    const [sy, sm, sd] = monthRange.start.split('-').map(Number);
    const [ey, em, ed] = monthRange.end.split('-').map(Number);

    let actual = 0, total = 0;

    for (let d = new Date(sy, sm - 1, sd); d <= new Date(ey, em - 1, ed); d.setDate(d.getDate() + 1)) {
        const dateStr = DateUtils.toLocalDateStr(d);
        const dow = d.getDay();
        if (dow === 0 || dow === 6) continue;
        if (holidays.some(h => h.date === dateStr)) continue;

        total++;
        const wl = workLogs.find(l => l.teacher_id == currentTeacherId && l.work_date === dateStr);
        if (wl && wl.work_type !== 'holiday' && isWorkLogComplete(wl)) actual++;
    }

    updateWorkStats(actual, total);
}

// ============================================================
// 자동 저장 알림
// ============================================================
function showAutosaveNotification() {
    const n = document.getElementById('autosaveNotification');
    n.classList.add('show');
    setTimeout(() => n.classList.remove('show'), 2000);
}
