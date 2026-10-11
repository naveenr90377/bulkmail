
import { useState, useEffect } from "react"
import axios from "axios"
import * as XLSX from "xlsx"
import "./App.css"

function App() {
    const API_BASE_URL =
        window.location.hostname === "localhost"
            ? "http://localhost:5000"
            : "https://bulkmail-flaz.onrender.com"

    const [subject, setSubject] = useState("")
    const [msg, setMsg] = useState("")
    const [status, setStatus] = useState(false)
    const [alert, setAlert] = useState("")
    const [emailList, setEmailList] = useState([])
    const [history, setHistory] = useState([])

    useEffect(function () {
        fetchHistory()
    }, [])

    async function fetchHistory() {
        try {
            const response = await axios.get(
                `${API_BASE_URL}/history`
            )

            setHistory(response.data)
        } catch (error) {
            console.error(
                "Error fetching history:",
                error.response?.data || error.message
            )
        }
    }

    function handlefile(event) {
        const file = event.target.files[0]

        if (!file) {
            setEmailList([])
            return
        }

        if (!/\.(xlsx|xls)$/i.test(file.name)) {
            setEmailList([])
            setAlert("Please select an Excel file (.xlsx or .xls).")
            event.target.value = ""
            return
        }

        const reader = new FileReader()

        reader.onload = function (event) {
            try {
                const data = new Uint8Array(event.target.result)
                const workbook = XLSX.read(data, {
                    type: "array"
                })

                const sheetName = workbook.SheetNames[0]

                if (!sheetName) {
                    throw new Error("No worksheet found.")
                }

                const worksheet = workbook.Sheets[sheetName]

                const rows = XLSX.utils.sheet_to_json(
                    worksheet,
                    {
                        header: 1,
                        defval: ""
                    }
                )

                const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

                const extractedEmails = [
                    ...new Set(
                        rows
                            .flat()
                            .filter(function (cell) {
                                return typeof cell === "string"
                            })
                            .map(function (cell) {
                                return cell.trim()
                            })
                            .filter(function (cell) {
                                return emailPattern.test(cell)
                            })
                    )
                ]

                setEmailList(extractedEmails)

                setAlert(
                    extractedEmails.length > 0
                        ? `${extractedEmails.length} valid email address(es) loaded.`
                        : "No valid email addresses found in the Excel file."
                )
            } catch (error) {
                console.error("Excel file error:", error.message)
                setEmailList([])
                setAlert("Could not read the Excel file.")
            }
        }

        reader.onerror = function () {
            setEmailList([])
            setAlert("Could not read the selected file.")
        }

        reader.readAsArrayBuffer(file)
    }

    async function send() {
        if (
            !subject.trim() ||
            !msg.trim() ||
            emailList.length === 0
        ) {
            setAlert(
                "Enter a subject and message, then upload an Excel file containing valid email addresses."
            )
            return
        }

        setStatus(true)
        setAlert("Sending emails...")

        try {
            const response = await axios.post(
                `${API_BASE_URL}/sendmail`,
                {
                    subject: subject.trim(),
                    msg: msg.trim(),
                    emailList: emailList
                }
            )

            const result = response.data

            if (result.success) {
                setAlert(
                    `Success: ${result.sentCount} of ${result.totalRecipients} emails accepted by the mail server.`
                )

                setSubject("")
                setMsg("")
                setEmailList([])

                const fileInput =
                    document.getElementById("recipient-file")

                if (fileInput) {
                    fileInput.value = ""
                }
            } else if (result.status === "Partial") {
                setAlert(
                    `Partial success: ${result.sentCount} sent; ${result.failedCount} failed.`
                )
            } else {
                setAlert(result.message || "Email sending failed.")
            }
        } catch (error) {
            console.error(
                "Send request failed:",
                error.response?.data || error.message
            )

            setAlert(
                error.response?.data?.message ||
                "Email sending failed. Check the backend logs."
            )
        } finally {
            setStatus(false)
            await fetchHistory()
        }
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
                    Send multiple personalized emails at once and track your campaign history
                </h2>
            </div>

            <div className="max-w-3xl mx-auto mt-8 bg-blue-500 rounded-lg shadow-xl p-6 text-black">
                <h2 className="text-xl font-bold text-white mb-4 text-center">
                    Compose New Campaign
                </h2>

                <input
                    type="text"
                    value={subject}
                    onChange={function (event) {
                        setSubject(event.target.value)
                    }}
                    className="w-full py-2 px-3 outline-none bg-white border border-gray-300 rounded-md mb-4"
                    placeholder="Enter email subject..."
                />

                <textarea
                    value={msg}
                    onChange={function (event) {
                        setMsg(event.target.value)
                    }}
                    className="w-full h-32 py-2 px-3 outline-none bg-white border border-gray-300 rounded-md mb-4"
                    placeholder="Enter the email body text..."
                />

                <div className="flex flex-col items-center justify-center border-4 border-dashed border-white/60 py-6 px-4 rounded-md bg-blue-400 mb-4">
                    <label
                        htmlFor="recipient-file"
                        className="text-white font-medium mb-2"
                    >
                        Upload Recipient List (Excel File .xlsx/.xls)
                    </label>

                    <input
                        id="recipient-file"
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handlefile}
                        className="text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-950 file:text-white hover:file:bg-blue-900 cursor-pointer"
                    />
                </div>

                <div className="flex justify-between items-center text-white font-medium mb-4">
                    <p>Total Emails Selected:</p>

                    <span className="bg-blue-950 px-3 py-1 rounded-full text-sm">
                        {emailList.length}
                    </span>
                </div>

                <div className="text-center">
                    <button
                        onClick={send}
                        disabled={status}
                        className="bg-blue-950 hover:bg-blue-900 text-white font-semibold py-2.5 px-8 rounded-md transition-all shadow-md cursor-pointer disabled:opacity-50"
                    >
                        {status
                            ? "Sending Emails..."
                            : "Send Bulk Emails"}
                    </button>
                </div>

                {alert && (
                    <div
                        role="status"
                        className="mt-4 p-3 bg-white/90 rounded-md text-center font-medium text-blue-950 shadow"
                    >
                        {alert}
                    </div>
                )}
            </div>

            <div className="max-w-4xl mx-auto mt-10 bg-slate-800 rounded-lg shadow-xl p-6 text-white">
                <h2 className="text-2xl font-bold mb-4 text-blue-400 border-b border-slate-700 pb-2">
                    Campaign History Log
                </h2>

                {history.length === 0 ? (
                    <p className="text-slate-400 text-center py-4">
                        No email campaigns recorded yet.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-700 text-slate-300 text-sm">
                                    <th className="py-3 px-4">Date</th>
                                    <th className="py-3 px-4">Subject</th>
                                    <th className="py-3 px-4">Recipients</th>
                                    <th className="py-3 px-4">Status</th>
                                </tr>
                            </thead>

                            <tbody>
                                {history.map(function (item) {
                                    let statusClass = "bg-red-900 text-red-200"

                                    if (item.status === "Success") {
                                        statusClass = "bg-green-900 text-green-200"
                                    } else if (item.status === "Partial") {
                                        statusClass = "bg-yellow-900 text-yellow-200"
                                    }

                                    return (
                                        <tr
                                            key={item._id}
                                            className="border-b border-slate-700/50 hover:bg-slate-700/30 text-sm"
                                        >
                                            <td className="py-3 px-4 text-slate-400">
                                                {new Date(item.date).toLocaleString()}
                                            </td>

                                            <td className="py-3 px-4 font-medium">
                                                {item.subject}
                                            </td>

                                            <td className="py-3 px-4">
                                                {item.recipientCount} emails
                                            </td>

                                            <td className="py-3 px-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusClass}`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

export default App
