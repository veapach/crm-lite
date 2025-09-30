import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

const NewTicketsContext = createContext(null);

export const NewTicketsProvider = ({ children }) => {
	const [unassignedCount, setUnassignedCount] = useState(0);
	const [hasNewTickets, setHasNewTickets] = useState(false);
	const isMountedRef = useRef(false);

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	const fetchUnassignedCount = async () => {
		try {
			const response = await axios.get('/api/client-tickets', { params: { status: 'Не назначено', page: 1, limit: 1, sort: 'desc' } });
			const total = Number(response?.data?.total ?? 0);
			if (!isMountedRef.current) return;
			setUnassignedCount(total);
			setHasNewTickets(total > 0);
		} catch (e) {
			if (!isMountedRef.current) return;
			setUnassignedCount(0);
			setHasNewTickets(false);
		}
	};

	useEffect(() => {
		const interval = setInterval(fetchUnassignedCount, 15000);
		fetchUnassignedCount();
		return () => clearInterval(interval);
	}, []);

	const value = useMemo(() => ({ hasNewTickets, newTicketsCount: unassignedCount }), [hasNewTickets, unassignedCount]);

	return (
		<NewTicketsContext.Provider value={value}>{children}</NewTicketsContext.Provider>
	);
};

export const useNewTickets = () => useContext(NewTicketsContext); 