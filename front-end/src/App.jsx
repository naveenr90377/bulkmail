import { useState } from "react"
import axios from "axios"
import * as XLSX from "xlsx"
import "./App.css"

function App() {
    const API_BASE_URL = window.location.hostname === "localhost"
        ? "http://localhost:5000"
        : "https://bulkmail-production-0752.up.railway.app";

    const [subject, setSubject] = useState("")
    const [msg, setMsg] = useState("")
    const [status, setStatus] = useState(false)
    const [alert, setAlert] = useState("")
    const [emailList, setEmailList] = useState([])

    function handleSubject(event) {
        setSubject(event.target.value)
    }

    function handlemsg(event) {
        setMsg(event.target.value)
    }

    function handlefile(event) {
        const file = event.target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result)
            const workbook = XLSX.read(data, { type: "array" })
            const sheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[sheetName]
            
            const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
            let extractedEmails = []
            
            jsonRows.forEach(row => {
                row.forEach(cell => {
                    if (cell && typeof cell === "string" && cell.includes("@")) {
                        extractedEmails.push(cell.trim())
                    }
                })
            })

            setEmailList(extractedEmails)
        }
        reader.readAsArrayBuffer(file)
    }

    function send() {
        if (!subject || !msg || emailList.length === 0) {
            setAlert("Please enter a subject, message, and upload an Excel file containing valid emails.")
            return
        }
        
        setStatus(true)
        setAlert("")
        
        axios.post(`${API_BASE_URL}/sendmail`, {
            subject: subject,
            msg: msg,
            emailList: emailList
        })
        .then(() => {
            setStatus(false)
            setAlert("Emails sent successfully!")
            setSubject("")
            setMsg("")
            setEmailList([])
        })
        .catch((error) => {
            console.log(error)
            setStatus(false)
            setAlert("Email sending failed! Check backend terminal for details.")
        })
    }

    return (
        <div className="min-h-screen bg-slate-900 pb-10">
            <div className="bg-blue-950 text-white text-center shadow-md">
                <h1 className="text-3xl font-bold px-5 py-4">
                    Bulk Mail Application Dashboard
                </h1>
            </div>
            <div className="bg-blue-800 text-white text-center">
                <h2 className="font-medium px-5 py-2 text-sm md:text-base">
                    Send multiple personalized emails at once seamlessly
                </h2>
            </div>

            <div className="max-w-3xl mx-auto mt-8 bg-blue-500 rounded-lg shadow-xl p-6 text-black">
                <h2 className="text-xl font-bold text-white mb-4 text-center">Compose New Campaign</h2>
                
                <input
                    type="text"
                    onChange={handleSubject}
                    value={subject}
                    className="w-full py-2 px-3 outline-none bg-white border border-gray-300 rounded-md mb-4"
                    placeholder="Enter email subject...."
                />
                
                <textarea
                    onChange={handlemsg}
                    value={msg}
                    className="w-full h-32 py-2 px-3 outline-none bg-white border border-gray-300 rounded-md mb-4"
                    placeholder="Enter the email body text...."
                ></textarea>

                <div className="flex flex-col items-center justify-center border-4 border-dashed border-white/60 py-6 px-4 rounded-md bg-blue-400 mb-4">
                    <label className="text-white font-medium mb-2">Upload Recipient List (Excel File .xlsx/.xls)</label>
                    <input
                        onChange={handlefile}
                        type="file"
                        accept=".xlsx, .xls"
                        className="text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-950 file:text-white hover:file:bg-blue-900 cursor-pointer"
                    />
                </div>

                <div className="flex justify-between items-center text-white font-medium mb-4">
                    <p>Total Emails Selected:</p>
                    <span className="bg-blue-950 px-3 py-1 rounded-full text-sm">{emailList.length}</span>
                </div>

                <div className="text-center">
                    <button
                        onClick={send}
                        disabled={status}
                        className="bg-blue-950 hover:bg-blue-900 text-white font-semibold py-2.5 px-8 rounded-md transition-all shadow-md cursor-pointer disabled:opacity-50"
                    >
                        {status ? "Sending Emails..." : "Send Bulk Emails"}
                    </button>
                </div>

                {alert && (
                    <div className="mt-4 p-3 bg-white/90 rounded-md text-center font-medium text-blue-950 shadow">
                        {alert}
                    </div>
                )}
            </div>
        </div>
    )
}

export default App