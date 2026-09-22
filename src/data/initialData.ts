import type { AttendanceState, DayRecord, Member, Team } from "../types";
import { emptyDayRecord } from "../types";

let _id = 0;
const m = (name: string, bold = false): Member => ({
  id: `m_${_id++}_${name}`,
  name,
  bold,
});

/** 현재 운영 중인 명단 (Firestore 기준). 새 기기/초기화 시 이 목록으로 시작합니다. */
export const INITIAL_TEAMS: Team[] = [
  {
    id: "sarang",
    name: "사랑조",
    color: "#FFF4D6",
    youth: [
      m("조영우"),
      m("정성현"),
      m("윤정석"),
      m("여태민"),
      m("서성민"),
      m("김정우"),
      m("김이안"),
      m("이승준"),
      m("이경석"),
      m("임승원"),
      m("이효림"),
      m("김경찬"),
      m("최서아"),
      m("김규래"),
      m("김찬영"),
    ],
    teachers: [
      m("안제영", true),
      m("구선희"),
      m("윤선택"),
      m("구승섭"),
      m("윤수진"),
      m("김명희"),
      m("박영권"),
      m("전정옥"),
      m("조혜숙"),
      m("정남기"),
      m("정순영"),
      m("김위영"),
      m("유재현"),
    ],
  },
  {
    id: "mideum",
    name: "믿음조",
    color: "#FFE0E9",
    youth: [
      m("김하연"),
      m("김채원"),
      m("임동한"),
      m("강민주"),
      m("이규섭"),
      m("정지용"),
      m("허태영"),
      m("백종찬"),
      m("서재원"),
      m("장유빈"),
      m("김환희"),
      m("이동민"),
      m("윤찬민"),
      m("장시우"),
      m("황상현"),
      m("남경무"),
    ],
    teachers: [
      m("김정희", true),
      m("오정희"),
      m("김지원"),
      m("심혜원"),
      m("정태훈"),
      m("신해경"),
      m("전우진"),
      m("전예하"),
      m("최하라"),
      m("남아라"),
      m("임세희"),
      m("김오순"),
      m("조조남"),
    ],
  },
  {
    id: "innae",
    name: "인내조",
    color: "#DCEEFB",
    youth: [
      m("김민성A"),
      m("이종명"),
      m("김수연"),
      m("이영진"),
      m("김세현"),
      m("나현호"),
      m("신우진"),
      m("정혜진"),
      m("전민호"),
      m("설찬엽"),
      m("송종화"),
      m("이시원"),
      m("박준우"),
      m("이은호"),
      m("박세준"),
    ],
    teachers: [
      m("김지영", true),
      m("김진욱"),
      m("김정우"),
      m("고정화"),
      m("김종진"),
      m("한민경"),
      m("박미경"),
      m("이예린"),
      m("안희주"),
      m("이동욱"),
      m("심재은"),
    ],
  },
  {
    id: "younggwang",
    name: "영광조",
    color: "#DCF5E3",
    youth: [
      m("이권재"),
      m("오종석"),
      m("김지나"),
      m("이세준"),
      m("홍석환"),
      m("김현재"),
      m("윤재인"),
      m("박태윤"),
      m("송윤서"),
      m("김민주"),
      m("이규민"),
      m("김민성B"),
      m("임종찬"),
      m("김연재"),
      m("이필호"),
      m("최서인"),
    ],
    teachers: [
      m("윤정진", true),
      m("이복순"),
      m("임대성"),
      m("송승혜"),
      m("이미영"),
      m("박규수"),
      m("박수연"),
      m("정희연"),
      m("이혜원"),
      m("박경원"),
      m("이명선"),
      m("이수한"),
      m("명관선"),
    ],
  },
  {
    id: "soman",
    name: "소망조",
    color: "#EADCFB",
    youth: [
      m("정윤오"),
      m("박준성"),
      m("조상화"),
      m("이시진"),
      m("윤영수"),
      m("임효신"),
      m("김규나"),
      m("박기훈"),
      m("이승수"),
      m("민은혜"),
      m("이서준"),
      m("전준서"),
      m("이준영"),
      m("방태현"),
    ],
    teachers: [
      m("이성숙", true),
      m("김혜정"),
      m("김봉길"),
      m("임성규"),
      m("김성숙"),
      m("유미현"),
      m("송진혁"),
      m("장미아"),
      m("이은희"),
      m("주현기"),
    ],
  },
];

const todayIso = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

let _xid = 0;
const ex = (name: string) => ({ id: `x_${_xid++}_${name}`, name });

const today = todayIso();

const initialRecord: DayRecord = {
  ...emptyDayRecord(),
  notes: {
    teacherCounts: "",
    newcomers: "",
  },
};

export const INITIAL_STATE: AttendanceState = {
  date: today,
  teams: INITIAL_TEAMS,
  ministers: [ex("윤선영")],
  volunteerTeachers: [
    ex("기광국"),
    ex("이순민"),
    ex("황규선"),
    ex("최영훈"),
  ],
  observers: [],
  records: { [today]: initialRecord },
};
