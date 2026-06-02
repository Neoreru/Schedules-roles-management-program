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
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
  "00:00"
]

function App() {
  const [page, setPage] = useState("main")
  const [members, setMembers] = useState([])
  const [name, setName] = useState("")
  const [minPeople, setMinPeople] = useState(2)

  // Firebase 실시간 동기화
  useEffect(() => {
    const q = query(
      collection(db, "members"),
      orderBy("createdAt", "asc")
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const memberList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      setMembers(memberList)
    })

    return () => unsubscribe()
  }, [])

  // 팀원 추가
  const addMember = async () => {
    if (name.trim() === "") return

    await addDoc(collection(db, "members"), {
      name,
      availableTimes: [],
      role: "",
      memo: "",
      createdAt: Date.now(),
    })

    setName("")
  }

  // 팀원 삭제
  const deleteMember = async (id) => {
    await deleteDoc(doc(db, "members", id))
  }

  // 이름 수정
  const updateMemberName = async (id, newName) => {
    await updateDoc(doc(db, "members", id), {
      name: newName,
    })
  }

  // 시간 체크
  const toggleTime = async (member, day, time) => {
    const timeKey = `${day} ${time}`

    const availableTimes = member.availableTimes || []

    const alreadySelected =
      availableTimes.includes(timeKey)

    const newAvailableTimes = alreadySelected
      ? availableTimes.filter((t) => t !== timeKey)
      : [...availableTimes, timeKey]

    await updateDoc(doc(db, "members", member.id), {
      availableTimes: newAvailableTimes,
    })
  }

  // 역할 수정
  const updateRole = async (id, role) => {
    await updateDoc(doc(db, "members", id), {
      role,
    })
  }

  // 메모 수정
  const updateMemo = async (id, memo) => {
    await updateDoc(doc(db, "members", id), {
      memo,
    })
  }

  // 공통 가능 시간 계산
  const getCommonTimes = () => {
    const result = []

    days.forEach((day) => {
      times.forEach((time) => {
        const timeKey = `${day} ${time}`

        const availableMembers = members.filter(
          (member) =>
            (member.availableTimes || []).includes(
              timeKey
            )
        )

        if (availableMembers.length >= minPeople) {
          result.push({
            time: timeKey,
            members: availableMembers.map(
              (member) => member.name
            ),
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
        <button onClick={() => setPage("main")}>
          메인 페이지
        </button>

        <button onClick={() => setPage("team")}>
          팀 관리 페이지
        </button>

        <button onClick={() => setPage("role")}>
          역할 관리 페이지
        </button>
      </nav>

      {/* 메인 페이지 */}
      {page === "main" && (
        <section>
          <h2>공통 가능 시간</h2>

          <label>
            최소 가능 인원:

            <input
              type="number"
              value={minPeople}
              min="1"
              onChange={(e) =>
                setMinPeople(Number(e.target.value))
              }
            />
          </label>

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

                  <td>
                    {item.members.join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 팀 관리 페이지 */}
      {page === "team" && (
        <section>
          <h2>팀원 정보 관리</h2>

          <input
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
            placeholder="팀원 이름 입력"
          />

          <button onClick={addMember}>
            추가
          </button>

          {members.map((member) => (
            <div className="card" key={member.id}>
              <input
                value={member.name}
                onChange={(e) =>
                  updateMemberName(
                    member.id,
                    e.target.value
                  )
                }
              />

              <button
                onClick={() =>
                  deleteMember(member.id)
                }
              >
                삭제
              </button>

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
                        const timeKey =
                          `${day} ${time}`

                        const checked =
                          (
                            member.availableTimes ||
                            []
                          ).includes(timeKey)

                        return (
                          <td key={day}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleTime(
                                  member,
                                  day,
                                  time
                                )
                              }
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3>선택된 가능 시간</h3>

              <p>
                {(member.availableTimes || [])
                  .length > 0
                  ? member.availableTimes.join(", ")
                  : "선택된 시간이 없습니다."}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* 역할 페이지 */}
      {page === "role" && (
        <section>
          <h2>역할 및 메모 관리</h2>

          {members.map((member) => (
            <div className="card" key={member.id}>
              <h3>{member.name}</h3>

              <input
                value={member.role || ""}
                onChange={(e) =>
                  updateRole(
                    member.id,
                    e.target.value
                  )
                }
                placeholder="역할 입력"
              />

              <textarea
                value={member.memo || ""}
                onChange={(e) =>
                  updateMemo(
                    member.id,
                    e.target.value
                  )
                }
                placeholder="메모 입력"
              />

              <p>
                <strong>{member.name}</strong>
                {" - "}
                {member.role || "역할 없음"}
              </p>

              <p>
                메모: {member.memo || "메모 없음"}
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

export default App