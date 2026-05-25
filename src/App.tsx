import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import TeamTabs from "./components/TeamTabs";
import TeamAttendance from "./components/TeamAttendance";
import ExtraGroups from "./components/ExtraGroups";
import EditMembersModal from "./components/EditMembersModal";
import SnapshotModal from "./components/SnapshotModal";
import RecordsModal from "./components/RecordsModal";
import InstallPrompt from "./components/InstallPrompt";
import PasswordModal from "./components/PasswordModal";
import { AttendanceProvider, useAttendance } from "./store/AttendanceStore";
import type { TeamId } from "./types";

function AttendanceScreen() {
  const { state, currentDay } = useAttendance();
  const [selectedTeam, setSelectedTeam] = useState<TeamId>(
    () => state.teams.find((t) => t.id === "innae")?.id ?? state.teams[0]?.id ?? "",
  );

  useEffect(() => {
    if (!state.teams.some((t) => t.id === selectedTeam)) {
      setSelectedTeam(state.teams[0]?.id ?? "");
    }
  }, [state.teams, selectedTeam]);
  const [editOpen, setEditOpen] = useState(false);
  const [editPwOpen, setEditPwOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPwOpen, setExportPwOpen] = useState(false);

  const totals = useMemo(() => {
    let totalYouth = 0;
    let presentYouth = 0;
    let totalTeachers = 0;
    let presentTeachers = 0;
    const presentByTeam: Record<TeamId, number> = {
      sarang: 0,
      mideum: 0,
      innae: 0,
      younggwang: 0,
      soman: 0,
    };
    for (const team of state.teams) {
      totalYouth += team.youth.length;
      totalTeachers += team.teachers.length;
      const yCount = team.youth.filter(
        (m) => currentDay.presentIds[m.id],
      ).length;
      const tCount = team.teachers.filter(
        (m) => currentDay.presentIds[m.id],
      ).length;
      presentYouth += yCount;
      presentTeachers += tCount;
      presentByTeam[team.id] = yCount + tCount;
    }
    return { totalYouth, presentYouth, totalTeachers, presentTeachers, presentByTeam };
  }, [state, currentDay]);

  const team = state.teams.find((t) => t.id === selectedTeam);

  return (
    <div className="mx-auto flex min-h-full max-w-screen-md flex-col">
      <Header
        totalYouth={totals.totalYouth}
        presentYouth={totals.presentYouth}
        totalTeachers={totals.totalTeachers}
        presentTeachers={totals.presentTeachers}
        onOpenSnapshot={() => setSnapshotOpen(true)}
        onOpenEdit={() => setEditPwOpen(true)}
        onOpenRecords={() => setExportPwOpen(true)}
      />

      <InstallPrompt />

      <div className="px-4">
        <TeamTabs
          teams={state.teams}
          selected={selectedTeam}
          onSelect={setSelectedTeam}
          presentByTeam={totals.presentByTeam}
        />
      </div>

      <main className="flex-1 space-y-3 px-4 pt-2 pb-24">
        {team ? (
          <TeamAttendance team={team} />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
            아직 등록된 조가 없습니다. 명단 편집에서 조를 추가하세요.
          </div>
        )}
        <ExtraGroups />
      </main>

      <EditMembersModal
        open={editOpen}
        initialTeamId={selectedTeam}
        onClose={() => setEditOpen(false)}
      />
      <PasswordModal
        open={editPwOpen}
        title="명단 편집 잠금"
        description="명단을 편집하려면 비밀번호를 입력하세요."
        expected="0000"
        confirmLabel="열기"
        onCancel={() => setEditPwOpen(false)}
        onConfirm={() => {
          setEditPwOpen(false);
          setEditOpen(true);
        }}
      />
      <SnapshotModal open={snapshotOpen} onClose={() => setSnapshotOpen(false)} />
      <RecordsModal open={exportOpen} onClose={() => setExportOpen(false)} />
      <PasswordModal
        open={exportPwOpen}
        title="기록 / 엑셀 잠금"
        description="기록을 열려면 비밀번호를 입력하세요."
        expected="0000"
        confirmLabel="열기"
        onCancel={() => setExportPwOpen(false)}
        onConfirm={() => {
          setExportPwOpen(false);
          setExportOpen(true);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AttendanceProvider>
      <AttendanceScreen />
    </AttendanceProvider>
  );
}
