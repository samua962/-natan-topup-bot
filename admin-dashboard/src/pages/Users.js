import React, { useEffect, useState } from "react";
import API from "../api/api";

export default function Users() {
    const [users, setUsers] = useState([]);
    const [totalUsers, setTotalUsers] = useState(0);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const limit = 20;

    // Giveaway state
    const [currentRound, setCurrentRound] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [prizeAmount, setPrizeAmount] = useState("");
    const [pickingWinner, setPickingWinner] = useState(false);
    const [winnerInfo, setWinnerInfo] = useState(null);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const res = await API.get(`/users?search=${search}&limit=${limit}&offset=${page * limit}`);
            setUsers(res.data.users);
            setTotalUsers(res.data.total);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    const loadGiveawayData = async () => {
        try {
            const current = await API.get("/giveaway/current");
            setCurrentRound(current.data.round);
            setPrizeAmount(current.data.round.prize_amount.toString());
            const ticketsRes = await API.get("/giveaway/tickets");
            setTickets(ticketsRes.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        loadUsers();
        loadGiveawayData();
    }, [search, page]);

    const handleSetPrize = async () => {
        if (!prizeAmount || isNaN(parseFloat(prizeAmount))) {
            alert("Enter a valid prize amount");
            return;
        }
        try {
            await API.put("/giveaway/prize", { prizeAmount: parseFloat(prizeAmount) });
            alert("Prize amount updated");
            loadGiveawayData();
        } catch (err) {
            alert("Failed to update prize");
        }
    };

    const handlePickWinner = async () => {
        if (!window.confirm("Are you sure you want to pick a random winner?")) return;
        setPickingWinner(true);
        try {
            const res = await API.post("/giveaway/pick-winner");
            setWinnerInfo(res.data.winner);
            alert(`Winner: User ${res.data.winner.user_id} with ticket ${res.data.winner.ticket}. Prize ${res.data.winner.prize} ETB added to wallet.`);
            loadGiveawayData();
            loadUsers(); // refresh users list to see balance update
        } catch (err) {
            alert(err.response?.data?.error || "Failed to pick winner");
        }
        setPickingWinner(false);
    };

    const handleResetGiveaway = async () => {
        if (!window.confirm("This will start a new giveaway round. Are you sure?")) return;
        try {
            await API.post("/giveaway/reset");
            alert("Giveaway reset. New round started.");
            loadGiveawayData();
            setWinnerInfo(null);
        } catch (err) {
            alert("Failed to reset giveaway");
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Users</h2>
            <div className="flex justify-between items-center">
                <input
                    type="text"
                    placeholder="Search by username or Telegram ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="border rounded px-3 py-2 w-64"
                />
                <p className="text-gray-600">Total users: {totalUsers}</p>
            </div>

            {loading ? (
                <p>Loading...</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="px-4 py-2">ID</th>
                                <th className="px-4 py-2">Telegram ID</th>
                                <th className="px-4 py-2">Username</th>
                                <th className="px-4 py-2">Joined</th>
                                <th className="px-4 py-2">Balance (ETB)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id}>
                                    <td className="border px-4 py-2">{u.id}</td>
                                    <td className="border px-4 py-2">{u.telegram_id}</td>
                                    <td className="border px-4 py-2">{u.username || "-"}</td>
                                    <td className="border px-4 py-2">{new Date(u.created_at).toLocaleDateString()}</td>
                                    <td className="border px-4 py-2">{u.balance || 0} ETB</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="flex justify-between items-center mt-4">
                <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
                >
                    Previous
                </button>
                <span>Page {page + 1}</span>
                <button
                    onClick={() => setPage(page + 1)}
                    disabled={users.length < limit}
                    className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
                >
                    Next
                </button>
            </div>

            {/* Giveaway Management Section */}
            <div className="mt-8 border-t pt-6">
                <h3 className="text-xl font-semibold mb-4">🎁 Giveaway Management</h3>
                {currentRound && (
                    <div className="bg-white p-4 rounded shadow mb-4">
                        <p><strong>Current Round:</strong> #{currentRound.id}</p>
                        <p><strong>Status:</strong> {currentRound.status}</p>
                        <p><strong>Prize Amount:</strong> {currentRound.prize_amount} ETB</p>
                        <p><strong>Tickets Issued:</strong> {tickets.length} / 1000</p>
                        {currentRound.winner_id && (
                            <p><strong>Winner:</strong> User {currentRound.winner_id} (Ticket {currentRound.winner_ticket})</p>
                        )}
                    </div>
                )}
                <div className="flex flex-wrap gap-4 mb-4">
                    <div className="flex items-center space-x-2">
                        <input
                            type="number"
                            step="1"
                            value={prizeAmount}
                            onChange={(e) => setPrizeAmount(e.target.value)}
                            className="border rounded px-3 py-2 w-32"
                            placeholder="Prize (ETB)"
                        />
                        <button
                            onClick={handleSetPrize}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                        >
                            Set Prize
                        </button>
                    </div>
                    <button
                        onClick={handlePickWinner}
                        disabled={pickingWinner || tickets.length === 0 || currentRound?.status !== "active"}
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
                    >
                        {pickingWinner ? "Picking..." : "🎲 Pick Random Winner"}
                    </button>
                    <button
                        onClick={handleResetGiveaway}
                        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                    >
                        🔄 Reset Giveaway
                    </button>
                    <button
    onClick={async () => {
        if (!window.confirm("Deactivate the current giveaway? Users will not be able to claim tickets.")) return;
        try {
            await API.post("/giveaway/deactivate");
            alert("Giveaway deactivated");
            loadGiveawayData();
        } catch (err) {
            alert("Failed to deactivate");
        }
    }}
    className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
>
    ⏸️ Deactivate Giveaway
</button>
                </div>
                <h4 className="font-semibold mb-2">Tickets for current round</h4>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="min-w-full bg-white border">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="px-4 py-2">Ticket</th>
                                <th className="px-4 py-2">User (Telegram ID)</th>
                                <th className="px-4 py-2">Username</th>
                                <th className="px-4 py-2">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tickets.map((t) => (
                                <tr key={t.ticket_number}>
                                    <td className="border px-4 py-2">{t.ticket_number}</td>
                                    <td className="border px-4 py-2">{t.user_id}</td>
                                    <td className="border px-4 py-2">{t.username || "-"}</td>
                                    <td className="border px-4 py-2">{new Date(t.created_at).toLocaleString()}</td>
                                </tr>
                            ))}
                            {tickets.length === 0 && (
                                <tr><td colSpan="4" className="text-center py-4">No tickets yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}