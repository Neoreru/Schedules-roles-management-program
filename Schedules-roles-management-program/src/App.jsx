import { useEffect, useState } from "react"
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore"

import { db } from "./firebase"
import "./App.css"

const days = ["월", "화", "수", "목", "금", "토", "일"]

const times = [
  "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00",
  "17:00", "18:00", "19:00", "20:00",
  "21:00", "22:00", "23:00", "00:00",
]

function getDeviceId() {
  let deviceId = localStorage.getItem("deviceId")

  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem("deviceId", deviceId)
  }

  return deviceId
}

function App() {
  const [page, setPage] = useState("main")
  const [members, setMembers] = useState([])
  const [minPeople, setMinPeople] = useState(2)
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [deviceId] = useState(getDeviceId)

  const [editingNameId, setEditingNameId] = useState(null)
  const [editingName, setEditingName] = useState("")
  const [editingRoleId, setEditingRoleId] = useState(null)
  const [editingRole, setEditingRole] = useState("")
  const [editingMemo, setEditingMemo] = useState("")

  useEffect(() => {
    const q = query(collection(db, "members"), orderBy("createdAt", "asc"))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const memberList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      setMembers(memberList)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    setSelectedMemberIds((prev) => {
      const currentIds = members.map((member) => member.id)

      if (prev.length === 0) {
        return currentIds
      }

      const keptIds = prev.filter((id) => currentIds.includes(id))
      const newIds = currentIds.filter((id) => !prev.includes(id))

      return [...keptIds, ...newIds]
    })
  }, [members])

  const isMine = (member) => {
    return member.ownerId === deviceId || !member.ownerId
  }

  const myMembers = members.filter((member) => isMine(member))
  const hasMyMember = myMembers.length > 0

  const sortedMembers = [...members].sort((a, b) => {
    const aMine = isMine(a)
    const bMine = isMine(b)

    if (aMine && !bMine) return -1
    if (!aMine && bMine) return 1
    return 0
  })

  const selectedMembers = members.filter((member) =>
    selectedMemberIds.includes(member.id)
  )

  const addMember = async () => {
    await addDoc(collection(db, "members"), {
      name: "이름 없음",
      availableTimes: [],
      role: "",
      memo: "",
      ownerId: deviceId,
      createdAt: Date.now(),
    })
  }

  const deleteMember = async (member) => {
    if (!isMine(member)) return
    await deleteDoc(doc(db, "members", member.id))
  }

  const updateMemberName = async (member, newName) => {
    if (!isMine(member)) return
    await updateDoc(doc(db, "members", member.id), {
      name: newName,
    })
  }

  const toggleTime = async (member, day, time) => {
    if (!isMine(member)) return

    const timeKey = `${day} ${time}`
    const availableTimes = member.availableTimes || []
    const alreadySelected = availableTimes.includes(timeKey)

    const newAvailableTimes = alreadySelected
      ? availableTimes.filter((t) => t !== timeKey)
      : [...availableTimes, timeKey]

    await updateDoc(doc(db, "members", member.id), {
      availableTimes: newAvailableTimes,
    })
  }

  const updateRole = async (member, role) => {
    if (!isMine(member)) return
    await updateDoc(doc(db, "members", member.id), { role })
  }

  const updateMemo = async (member, memo) => {
    if (!isMine(member)) return
    await updateDoc(doc(db, "members", member.id), { memo })
  }

  const toggleSelectedMember = (memberId) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    )
  }

const getCommonTimes = () => {
  const result = []

  days.forEach((day) => {
    times.forEach((time) => {
      const timeKey = `${day} ${time}`

      // 포함해야 하는 팀원 중 이 시간에 가능한 사람
      const selectedAvailableMembers = selectedMembers.filter((member) =>
        (member.availableTimes || []).includes(timeKey)
      )

      // 전체 팀원 중 이 시간에 가능한 사람
      const allAvailableMembers = members.filter((member) =>
        (member.availableTimes || []).includes(timeKey)
      )

      // 조건 1: 포함해야 하는 팀원이 모두 가능해야 함
      const allSelectedMembersAvailable =
        selectedAvailableMembers.length === selectedMembers.length

      // 조건 2: 전체 가능한 인원이 최소 가능 인원 이상이어야 함
      const enoughPeople = allAvailableMembers.length >= minPeople

      if (
        selectedMembers.length > 0 &&
        allSelectedMembersAvailable &&
        enoughPeople
      ) {
        result.push({
          time: timeKey,
          members: allAvailableMembers.map((member) => member.name),
        })
      }
    })
  })

  return result
}

  return (
    <div className="container">
      <h1>팀 일정 및 역할 관리</h1>

      <nav>
        <button onClick={() => setPage("main")}>메인 페이지</button>
        <button onClick={() => setPage("team")}>시간 관리 페이지</button>
        <button onClick={() => setPage("role")}>역할 관리 페이지</button>
      </nav>

      {page === "main" && (
        <section>
          <h2>공통 가능 시간</h2>

          <label>
            최소 가능 인원:
            <input
              type="number"
              value={minPeople}
              min="1"
              onChange={(e) => setMinPeople(Number(e.target.value))}
            />
          </label>

          <div className="member-filter-box">
            <h3>포함해야하는 팀원</h3>

            {members.map((member) => (
              <label key={member.id} className="member-checkbox">
                <input
                  type="checkbox"
                  checked={selectedMemberIds.includes(member.id)}
                  onChange={() => toggleSelectedMember(member.id)}
                />
                {member.name}
              </label>
            ))}
          </div>

          <table>
            <thead>
              <tr>
                <th>시간</th>
                <th>가능한 팀원</th>
              </tr>
            </thead>

            <tbody>
              {getCommonTimes().map((item, index) => (
                <tr key={index}>
                  <td>{item.time}</td>
                  <td>{item.members.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {page === "team" && (
        <section>
          <h2>시간표 관리</h2>

          {!hasMyMember && (
            <div className="add-member-box">
              <button onClick={addMember}>내 정보 추가</button>
            </div>
          )}

          {sortedMembers.map((member) => {
            const mine = isMine(member)

            return (
              <div className="card" key={member.id}>
                {mine && editingNameId === member.id ? (
                  <div className="name-edit-box">
                    <input
                      className="name-input"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      placeholder="내 이름 입력"
                    />

                    <button
                      onClick={() => {
                        updateMemberName(member, editingName)
                        setEditingNameId(null)
                      }}
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <div className="name-view-box">
                    <strong>
                      {member.name} {mine ? "(내 정보)" : "(보기 전용)"}
                    </strong>

                    {mine && (
                      <button
                        onClick={() => {
                          setEditingNameId(member.id)
                          setEditingName(member.name)
                        }}
                      >
                        ↻
                      </button>
                    )}
                  </div>
                )}

                {mine ? (
                  <button onClick={() => deleteMember(member)}>삭제</button>
                ) : (
                  <p className="readonly-text">
                    다른 팀원의 정보라 수정할 수 없습니다.
                  </p>
                )}

                <h3>가능 시간 선택</h3>

                <table>
                  <thead>
                    <tr>
                      <th>시간</th>
                      {days.map((day) => (
                        <th key={day}>{day}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {times.map((time) => (
                      <tr key={time}>
                        <td>{time}</td>

                        {days.map((day) => {
                          const timeKey = `${day} ${time}`
                          const checked = (member.availableTimes || []).includes(
                            timeKey
                          )

                          return (
                            <td
                              key={day}
                              className={`time-cell ${checked ? "selected" : ""} ${
                                !mine ? "readonly" : ""
                              }`}
                              onClick={() => {
                                if (mine) toggleTime(member, day, time)
                              }}
                            >
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </section>
      )}

      {page === "role" && (
        <section>
          <h2>역할 및 메모 관리</h2>

          {sortedMembers.map((member) => {
            const mine = isMine(member)

            return (
              <div className="card" key={member.id}>
                <h3>
                  {member.name} {mine ? "(내 정보)" : "(보기 전용)"}
                </h3>

                {mine && editingRoleId === member.id ? (
                  <div className="role-input-box">
                    <input
                      className="role-input"
                      value={editingRole}
                      onChange={(e) => setEditingRole(e.target.value)}
                      placeholder="역할 입력"
                    />

                    <textarea
                      className="memo-input"
                      value={editingMemo}
                      onChange={(e) => setEditingMemo(e.target.value)}
                      placeholder="메모 입력"
                    />

                    <button
                      onClick={() => {
                        updateRole(member, editingRole)
                        updateMemo(member, editingMemo)
                        setEditingRoleId(null)
                      }}
                    >
                      ✓ 저장
                    </button>
                  </div>
                ) : (
                  <div className="role-view-box">
                    <p className="role-text">역할: {member.role || "역할 없음"}</p>
                    <p className="memo-text">메모: {member.memo || "메모 없음"}</p>

                    {mine && (
                      <button
                        onClick={() => {
                          setEditingRoleId(member.id)
                          setEditingRole(member.role || "")
                          setEditingMemo(member.memo || "")
                        }}
                      >
                        ↻ 수정
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}

export default App