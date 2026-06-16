import { useEffect, useState } from "react"
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  getDoc,
  getDocs,
  where,
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

function getSavedRooms() {
  return JSON.parse(localStorage.getItem("joinedRooms") || "[]")
}

function saveJoinedRoom(roomCode, roomName) {
  const savedRooms = getSavedRooms()
  const alreadyExists = savedRooms.some((room) => room.code === roomCode)

  if (alreadyExists) return

  const newRooms = [
    ...savedRooms,
    {
      code: roomCode,
      roomName,
      joinedAt: Date.now(),
    },
  ]

  localStorage.setItem("joinedRooms", JSON.stringify(newRooms))
}

function removeJoinedRoom(roomCode) {
  const savedRooms = getSavedRooms()
  const newRooms = savedRooms.filter((room) => room.code !== roomCode)

  localStorage.setItem("joinedRooms", JSON.stringify(newRooms))
}

function App() {
  const [page, setPage] = useState("main")
  const [roomMode, setRoomMode] = useState("start")
  const [roomCode, setRoomCode] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [userName, setUserName] = useState("")
  const [roomName, setRoomName] = useState("")
  const [currentRoomName, setCurrentRoomName] = useState("")
  const [isJoined, setIsJoined] = useState(false)
  const [savedRooms, setSavedRooms] = useState(getSavedRooms)

  const [members, setMembers] = useState([])
  const [minPeople, setMinPeople] = useState(1)
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [viewMode, setViewMode] = useState("table")
  const [deviceId] = useState(getDeviceId)

  const [editingNameId, setEditingNameId] = useState(null)
  const [editingName, setEditingName] = useState("")
  const [editingRoleId, setEditingRoleId] = useState(null)
  const [editingRole, setEditingRole] = useState("")
  const [editingMemo, setEditingMemo] = useState("")

  useEffect(() => {
    if (!isJoined || !roomCode) return

    const q = query(
      collection(db, "rooms", roomCode, "members"),
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
  }, [isJoined, roomCode])

  useEffect(() => {
    if (!isJoined || !roomCode) return

    const loadRoomInfo = async () => {
      const roomRef = doc(db, "rooms", roomCode)
      const roomSnap = await getDoc(roomRef)

      if (roomSnap.exists()) {
        setCurrentRoomName(roomSnap.data().roomName || "이름 없는 방")
      }
    }

    loadRoomInfo()
  }, [isJoined, roomCode])

  useEffect(() => {
    setSelectedMemberIds((prev) => {
      const currentIds = members.map((member) => member.id)
      return prev.filter((id) => currentIds.includes(id))
    })
  }, [members])

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const createRoom = () => {
    const code = generateRoomCode()
    setRoomCode(code)
    setRoomMode("createName")
  }

  const hasMyMemberInRoom = async (code) => {
    const q = query(
      collection(db, "rooms", code, "members"),
      where("ownerId", "==", deviceId)
    )

    const snapshot = await getDocs(q)
    return !snapshot.empty
  }

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase()

    if (!code) {
      alert("방 코드를 입력해주세요.")
      return
    }

    const roomRef = doc(db, "rooms", code)
    const roomSnap = await getDoc(roomRef)

    if (!roomSnap.exists()) {
      alert("존재하지 않는 방입니다.")
      return
    }

    const alreadyHasMyMember = await hasMyMemberInRoom(code)

    setRoomCode(code)

    if (alreadyHasMyMember) {
      setRoomMode("alreadyJoined")
      return
    }

    setRoomMode("joinName")
  }

  const enterRoomWithName = async () => {
    const name = userName.trim()
    const newRoomName = roomName.trim()

    if (!name) {
      alert("사용자 이름을 입력해주세요.")
      return
    }

    if (roomMode === "createName" && !newRoomName) {
      alert("방 이름을 입력해주세요.")
      return
    }

    const roomRef = doc(db, "rooms", roomCode)
    const roomSnap = await getDoc(roomRef)

    if (!roomSnap.exists()) {
      await setDoc(roomRef, {
        roomName: newRoomName,
        ownerId: deviceId,
        createdAt: Date.now(),
      })
    }

    const alreadyHasMyMember = await hasMyMemberInRoom(roomCode)

    if (!alreadyHasMyMember) {
      await addDoc(collection(db, "rooms", roomCode, "members"), {
        name,
        availableTimes: [],
        role: "",
        memo: "",
        ownerId: deviceId,
        createdAt: Date.now(),
      })
    }

    saveJoinedRoom(roomCode, newRoomName || currentRoomName || "이름 없는 방")
    setSavedRooms(getSavedRooms())
    setIsJoined(true)
    setPage("main")
    setRoomMode("start")
    setUserName("")
    setRoomName("")
    setJoinCode("")
  }

  const enterSavedRoom = async (code) => {
    const roomRef = doc(db, "rooms", code)
    const roomSnap = await getDoc(roomRef)

    if (!roomSnap.exists()) {
      removeJoinedRoom(code)
      setSavedRooms(getSavedRooms())
      alert("존재하지 않는 방입니다. 목록에서 삭제했습니다.")
      return
    }

    const data = roomSnap.data()

    saveJoinedRoom(code, data.roomName || "이름 없는 방")
    setCurrentRoomName(data.roomName || "이름 없는 방")
    setSavedRooms(getSavedRooms())

    setRoomCode(code)
    setIsJoined(true)
    setPage("main")
  }

  const cleanSavedRooms = async () => {
    const rooms = getSavedRooms()
    const validRooms = []

    for (const room of rooms) {
      const roomRef = doc(db, "rooms", room.code)
      const roomSnap = await getDoc(roomRef)

      if (roomSnap.exists()) {
        const data = roomSnap.data()

        validRooms.push({
          ...room,
          roomName: data.roomName || "이름 없는 방",
        })
      }
    }

    localStorage.setItem("joinedRooms", JSON.stringify(validRooms))
    setSavedRooms(validRooms)
}

  const goToRoomList = () => {
    setIsJoined(false)
    setRoomCode("")
    setCurrentRoomName("")
    setPage("main")
    setMembers([])
    setSelectedMemberIds([])
    setEditingNameId(null)
    setEditingRoleId(null)
    setRoomMode("start")
    setSavedRooms(getSavedRooms())
  }

  const leaveRoom = async () => {
  const confirmLeave = window.confirm("이 방을 나가시겠습니까?")

  if (!confirmLeave) return

  const q = query(
    collection(db, "rooms", roomCode, "members"),
    where("ownerId", "==", deviceId)
  )

  const snapshot = await getDocs(q)

  const deletePromises = snapshot.docs.map((memberDoc) =>
    deleteDoc(doc(db, "rooms", roomCode, "members", memberDoc.id))
  )

  await Promise.all(deletePromises)

  // 남은 팀원 확인
  const remainSnapshot = await getDocs(
    collection(db, "rooms", roomCode, "members")
  )

  if (remainSnapshot.empty) {
    await deleteDoc(doc(db, "rooms", roomCode))
  }

  removeJoinedRoom(roomCode)

  setSavedRooms(getSavedRooms())
  setIsJoined(false)
  setRoomCode("")
  setCurrentRoomName("")
  setPage("main")
  setMembers([])
  setSelectedMemberIds([])
  setEditingNameId(null)
  setEditingRoleId(null)
  setRoomMode("start")
}

  const isMine = (member) => {
    return member.ownerId === deviceId
  }

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

  const memberDoc = (memberId) => {
    return doc(db, "rooms", roomCode, "members", memberId)
  }

  const updateMemberName = async (member, newName) => {
    if (!isMine(member)) return
    await updateDoc(memberDoc(member.id), { name: newName })
  }

  const toggleTime = async (member, day, time) => {
    if (!isMine(member)) return

    const timeKey = `${day} ${time}`
    const availableTimes = member.availableTimes || []
    const alreadySelected = availableTimes.includes(timeKey)

    const newAvailableTimes = alreadySelected
      ? availableTimes.filter((t) => t !== timeKey)
      : [...availableTimes, timeKey]

    await updateDoc(memberDoc(member.id), {
      availableTimes: newAvailableTimes,
    })
  }

  const updateRole = async (member, role) => {
    if (!isMine(member)) return
    await updateDoc(memberDoc(member.id), { role })
  }

  const updateMemo = async (member, memo) => {
    if (!isMine(member)) return
    await updateDoc(memberDoc(member.id), { memo })
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

        const allAvailableMembers = members.filter((member) =>
          (member.availableTimes || []).includes(timeKey)
        )

        const selectedAvailableMembers = selectedMembers.filter((member) =>
          (member.availableTimes || []).includes(timeKey)
        )

        const noSelectedMembers = selectedMembers.length === 0
        const allSelectedMembersAvailable =
          selectedAvailableMembers.length === selectedMembers.length

        const enoughPeople = allAvailableMembers.length >= (Number(minPeople) || 1)

        if (enoughPeople && (noSelectedMembers || allSelectedMembersAvailable)) {
          result.push({
            time: timeKey,
            members: allAvailableMembers.map((member) => member.name),
          })
        }
      })
    })

    return result
  }

  const isCommonTime = (day, time) => {
    const timeKey = `${day} ${time}`
    return getCommonTimes().some((item) => item.time === timeKey)
  }

  if (!isJoined) {
    return (
      <div className="start-screen-wrapper">
        <div className="container">
          {roomMode === "start" && (
            <section className="start-card">
              <div className="start-badge">TEAM SCHEDULER</div>

              <h1 className="start-title">
                팀플 시간, 역할 계획 프로그램
              </h1>

              <p className="start-description">
                방을 만들고 팀원들과 가능한 시간, 역할, 메모를 함께 관리해보세요.
              </p>

              <div className="start-button-box">
                <button className="primary-start-button" onClick={createRoom}>
                  방 생성
                </button>

                <button
                  className="secondary-start-button"
                  onClick={() => setRoomMode("join")}
                >
                  방 입장
                </button>

                <button
                  className="secondary-start-button"
                  onClick={async () => {
                    await cleanSavedRooms()
                    setRoomMode("savedRooms")
                  }}
                >
                  입장한 방 목록
                </button>
              </div>
            </section>
          )}

          {roomMode === "createName" && (
            <section className="fullscreen-center">
              <h2>방 정보 입력</h2>

              <div className="create-room-row">
                <input
                  className="name-input"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="방 이름 입력"
                />

                <input
                  className="name-input"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="내 이름 입력"
                />

                <button onClick={enterRoomWithName}>생성하기</button>

                <button
                  onClick={() => {
                    setRoomCode("")
                    setRoomName("")
                    setUserName("")
                    setRoomMode("start")
                  }}
                >
                  뒤로가기
                </button>
              </div>
            </section>
          )}

          {roomMode === "join" && (
            <section className="fullscreen-center">
              <h2>방 입장</h2>

              <div className="create-room-row">
                <input
                  className="name-input"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="방 코드 입력"
                />

                <button onClick={joinRoom}>입장하기</button>

                <button
                  onClick={() => {
                    setJoinCode("")
                    setRoomMode("start")
                  }}
                >
                  뒤로가기
                </button>
              </div>
            </section>
          )}

          {roomMode === "joinName" && (
            <section className="fullscreen-center">
              <h2>이름 입력</h2>
              <p>입장할 방 코드: {roomCode}</p>

              <div className="create-room-row">
                <input
                  className="name-input"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="내 이름 입력"
                />

                <button onClick={enterRoomWithName}>방 입장</button>

                <button
                  onClick={() => {
                    setUserName("")
                    setRoomMode("join")
                  }}
                >
                  뒤로가기
                </button>
              </div>
            </section>
          )}

          {roomMode === "alreadyJoined" && (
            <section className="fullscreen-center">
              <h2>이미 입장한 방입니다</h2>
              <p>기존 방 목록에서 해당 방으로 입장할 수 있습니다.</p>

              <div className="already-joined-buttons">
                <button
                  onClick={() => {
                    setIsJoined(true)
                    setPage("main")
                  }}
                >
                  기존 정보로 입장
                </button>

                <button
                  onClick={() => {
                    setRoomMode("join")
                    setJoinCode("")
                  }}
                >
                  뒤로가기
                </button>
              </div>
            </section>
          )}

          {roomMode === "savedRooms" && (
            <section>
              <h2>입장한 방 목록</h2>

              {savedRooms.length === 0 ? (
                <p>아직 들어간 방이 없습니다.</p>
              ) : (
                savedRooms.map((room) => (
                  <div className="card" key={room.code}>
                    <h3>{room.roomName || "이름 없는 방"}</h3>

                    <strong>방 코드: {room.code}</strong>

                    <button onClick={() => enterSavedRoom(room.code)}>
                      입장
                    </button>
                  </div>
                ))
              )}

              <button onClick={() => setRoomMode("start")}>뒤로가기</button>
            </section>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="top-bar">
        <div className="room-code-box">
          방 코드: <strong>{roomCode}</strong>
        </div>


        <button
          className="room-list-button"
          onClick={goToRoomList}
        >
          돌아가기
        </button>
      </div>

      <h1>{currentRoomName || "이름 없는 방"}</h1>

      <nav>
        <button
          className={page === "main" ? "active-button" : "inactive-button"}
          onClick={() => setPage("main")}
        >
          메인 페이지
        </button>

        <button
          className={page === "team" ? "active-button" : "inactive-button"}
          onClick={() => setPage("team")}
        >
          시간 관리 페이지
        </button>

        <button
          className={page === "role" ? "active-button" : "inactive-button"}
          onClick={() => setPage("role")}
        >
          역할 관리 페이지
        </button>
      </nav>

      {page === "main" && (
        <section>
          <h2>시간 확인</h2>

          <div className="member-filter-box">
            <div className="min-people-box">
              <label>
                최소 인원:
                <input
                  type="number"
                  value={minPeople}
                  min="1"
                  onChange={(e) => {
                    const value = e.target.value

                    if (value === "") {
                      setMinPeople("")
                    } else {
                      setMinPeople(Number(value))
                    }
                  }}
                  onBlur={() => {
                    if (minPeople === "" || Number(minPeople) < 1) {
                      setMinPeople(1)
                    }
                  }}
                />
              </label>
            </div>

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

          <div className="view-toggle-box">
            <button
              className={viewMode === "table" ? "active-button" : "inactive-button"}
              onClick={() => setViewMode("table")}
            >
              표
            </button>

            <button
              className={viewMode === "image" ? "active-button" : "inactive-button"}
              onClick={() => setViewMode("image")}
            >
              시간표
            </button>
          </div>

          {viewMode === "table" && (
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
          )}

          {viewMode === "image" && (
            <table className="common-time-grid">
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
                      const common = isCommonTime(day, time)

                      return (
                        <td
                          key={day}
                          className={common ? "common-time-block" : "empty-time-block"}
                        ></td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="leave-room-box">
            <button className="leave-room-button" onClick={leaveRoom}>
              나가기
            </button>
          </div>
        </section>
      )}

      {page === "team" && (
        <section>
          <h2>시간표 관리</h2>

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
                      {member.name} {mine ? "(내 정보)" : "(팀원)"}
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

                {!mine && (
                  <p className="readonly-text">
                    다른 팀원의 정보라 수정할 수 없습니다.
                  </p>
                )}

                <h3>가능 시간 선택</h3>
                <div className="time-table-wrapper">
                  <table className="time-table">
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
                            const checked = (member.availableTimes || []).includes(timeKey)

                            return (
                              <td
                                key={day}
                                className={`time-cell ${checked ? "selected" : ""} ${
                                  !mine ? "readonly" : ""
                                }`}
                                onClick={() => {
                                  if (mine) toggleTime(member, day, time)
                                }}
                              ></td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                  {member.name} {mine ? "(내 정보)" : "(팀원)"}
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