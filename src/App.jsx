import { useState } from "react"

function App() {
  const [name, setName] = useState("")
  const [members, setMembers] = useState([])

  const addMember = () => {
    if (name === "") return

    setMembers([...members, name])
    setName("")
  }

  return (
    <div>
      <h1>팀원 관리</h1>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="이름 입력"
      />

      <button onClick={addMember}>추가</button>

      <ul>
        {members.map((member, index) => (
          <li key={index}>{member}</li>
        ))}
      </ul>
    </div>
  )
}

export default App 
