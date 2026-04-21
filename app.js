// 애플리케이션 메인 JavaScript

// 역할 선택 함수
function selectRole(role) {
    if (role === 'teacher') {
        window.location.href = 'teacher-select.html';
    } else if (role === 'admin') {
        window.location.href = 'admin-login.html';
    }
}

// LocalStorage 유틸리티 함수
const Storage = {
    // 데이터 저장
    save: function(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('저장 실패:', error);
            return false;
        }
    },
    
    // 데이터 불러오기
    load: function(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('불러오기 실패:', error);
            return null;
        }
    },
    
    // 데이터 삭제
    remove: function(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('삭제 실패:', error);
            return false;
        }
    }
};

// 날짜 유틸리티 함수
const DateUtils = {
    // 로컬 날짜를 YYYY-MM-DD 문자열로 변환 (타임존 버그 방지)
    toLocalDateStr: function(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    // 오늘 날짜 반환 (YYYY-MM-DD) - 로컬 타임존 기준
    today: function() {
        return this.toLocalDateStr(new Date());
    },
    
    // 특정 달의 시작일과 마지막일 반환 (로컬 타임존 기준)
    getMonthRange: function(year, month) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        return {
            start: this.toLocalDateStr(startDate),
            end: this.toLocalDateStr(endDate)
        };
    },
    
    // 날짜가 평일인지 확인 (YYYY-MM-DD 문자열 - 로컬 파싱)
    isWeekday: function(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const day = date.getDay();
        return day !== 0 && day !== 6; // 0: 일요일, 6: 토요일
    },
    
    // 두 시간 차이 계산 (분 단위)
    timeDiffInMinutes: function(time1, time2) {
        const [h1, m1] = time1.split(':').map(Number);
        const [h2, m2] = time2.split(':').map(Number);
        return (h2 * 60 + m2) - (h1 * 60 + m1);
    },
    
    // 분을 시간과 분으로 변환
    minutesToHours: function(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return { hours, minutes: mins };
    }
};

// 급여 계산 유틸리티
const PayrollCalculator = {
    // 출근 시간 보정 (최대 20분 전까지만 인정)
    adjustCheckInTime: function(checkInTime, firstBusTime) {
        const diff = DateUtils.timeDiffInMinutes(checkInTime, firstBusTime);
        if (diff > 20) {
            // firstBusTime에서 20분 뺀 시간 계산
            const [h, m] = firstBusTime.split(':').map(Number);
            const adjustedMinutes = (h * 60 + m) - 20;
            const adjustedHours = Math.floor(adjustedMinutes / 60);
            const adjustedMins = adjustedMinutes % 60;
            return `${String(adjustedHours).padStart(2, '0')}:${String(adjustedMins).padStart(2, '0')}`;
        }
        return checkInTime;
    },
    
    // 하루 근무 시간 계산 (분 단위)
    calculateWorkMinutes: function(checkInTime, arrivalTime) {
        return DateUtils.timeDiffInMinutes(checkInTime, arrivalTime);
    },
    
    // 급여 계산
    calculateSalary: function(totalMinutes, hourlyRate) {
        const totalHours = totalMinutes / 60;
        return Math.round(totalHours * hourlyRate);
    }
};

// 초기 데이터 생성
function initializeData() {
    // 샘플 선생님 데이터
    const sampleTeachers = [
        { id: 1, name: '김철수', start_date: '2024-01-01', hourly_rate: 10000 },
        { id: 2, name: '이영희', start_date: '2024-01-01', hourly_rate: 10000 },
        { id: 3, name: '박지민', start_date: '2024-01-01', hourly_rate: 10000 }
    ];
    
    // LocalStorage에 데이터가 없으면 초기 데이터 저장
    if (!Storage.load('teachers')) {
        Storage.save('teachers', sampleTeachers);
    }
    
    if (!Storage.load('work_logs')) {
        Storage.save('work_logs', []);
    }
    
    if (!Storage.load('admin_password')) {
        Storage.save('admin_password', 'admin123');
    }
    
    // 휴원 일정 데이터 초기화
    if (!Storage.load('holidays')) {
        Storage.save('holidays', []);
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeData();
});

// 전역 객체로 노출
window.Storage = Storage;
window.DateUtils = DateUtils;
window.PayrollCalculator = PayrollCalculator;