/** 조 ID는 동적으로 추가/삭제 가능하므로 string으로 둔다.
 *  (초기 조는 "sarang", "mideum", "innae", "younggwang", "soman" 등) */
export type TeamId = string;

export type Role = "youth" | "teacher";

export interface Member {
  id: string;
  name: string;
  bold?: boolean;
}

export interface Team {
  id: TeamId;
  name: string;
  color: string;
  youth: Member[];
  teachers: Member[];
}

export interface ExtraPerson {
  id: string;
  name: string;
}

/** 한 날짜에 해당하는 출석 기록 (체크 표시 + 헌금 + 메모) */
export interface DayRecord {
  presentIds: Record<string, true>;
  ministersPresent: Record<string, true>;
  volunteerTeachersPresent: Record<string, true>;
  observersPresent: Record<string, true>;
  offering: number;
  notes: {
    teacherCounts?: string;
    newcomers?: string;
  };
}

/** 전역 상태: 명단(공용) + 날짜별 기록 */
export interface AttendanceState {
  date: string; // 현재 보고 있는 날짜 (YYYY-MM-DD)
  teams: Team[];
  ministers: ExtraPerson[];
  volunteerTeachers: ExtraPerson[];
  observers: ExtraPerson[];
  records: Record<string, DayRecord>; // 날짜 -> 기록
  /** 로컬·원격 충돌 시 최신 데이터를 고르기 위한 수정 시각(ms) */
  updatedAt?: number;
}

export const emptyDayRecord = (): DayRecord => ({
  presentIds: {},
  ministersPresent: {},
  volunteerTeachersPresent: {},
  observersPresent: {},
  offering: 0,
  notes: {},
});
