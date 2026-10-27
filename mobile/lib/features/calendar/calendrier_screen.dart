import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'data/calendar_event_model.dart';
import 'data/calendar_repository.dart';

class CalendrierScreen extends StatefulWidget {
  const CalendrierScreen({super.key});

  @override
  State<CalendrierScreen> createState() => _CalendrierScreenState();
}

class _CalendrierScreenState extends State<CalendrierScreen> {
  static const _darkNavy = Color(0xFF0A1227);
  static const _bg = Color(0xFFF7F8FA);
  static const _blue = Color(0xFF2E65F3);

  static const List<Color> _eventColors = [
    Color(0xFF2E65F3),
    Color(0xFF10B981),
    Color(0xFFFF9800),
    Color(0xFFEF4444),
    Color(0xFF8B5CF6),
  ];

  final CalendarRepository _repo = CalendarRepository();

  // view: 0=Mensuel 1=Hebdo 2=Jour
  int _viewIndex = 0;
  // filter: 0=Tous les ouvriers  1=Chantiers actifs
  int _filterIndex = 0;

  DateTime _selectedDay = DateTime.now();
  DateTime _currentMonth = DateTime(DateTime.now().year, DateTime.now().month);

  List<CalendarEvent> _allEvents = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final events = _filterIndex == 1
          ? await _repo.fetchActiveProjectEvents()
          : await _repo.fetchEvents();
      if (mounted) setState(() { _allEvents = events; _isLoading = false; });
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<CalendarEvent> get _eventsForSelectedDay {
    return _allEvents.where((e) {
      final d = e.startAt;
      return d.year == _selectedDay.year &&
          d.month == _selectedDay.month &&
          d.day == _selectedDay.day;
    }).toList();
  }

  Set<int> _daysWithEventsInMonth(int year, int month) {
    return _allEvents
        .where((e) => e.startAt.year == year && e.startAt.month == month)
        .map((e) => e.startAt.day)
        .toSet();
  }

  // ─── BUILD ─────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            _buildViewToggle(),
            _buildFilterRow(),
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: _blue))
                  : _viewIndex == 0
                      ? _buildMonthView()
                      : _viewIndex == 1
                          ? _buildWeekView()
                          : _buildDayView(),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: _darkNavy,
        onPressed: () async {
          await context.push('/calendrier/new-event');
          _load();
        },
        child: Icon(Icons.add, color: Theme.of(context).colorScheme.surface, size: 28),
      ),
    );
  }

  // ─── HEADER ────────────────────────────────────────────────

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => Navigator.of(context).canPop()
                ? context.pop()
                : context.go('/home'),
            child: const Icon(Icons.chevron_left, size: 28, color: _darkNavy),
          ),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              'Calendrier',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: _darkNavy,
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.search, color: _darkNavy),
            onPressed: () {},
          ),
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_none, color: _darkNavy),
                onPressed: () {},
              ),
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: Colors.red,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ─── VIEW TOGGLE (Mensuel / Hebdo / Jour) ──────────────────

  Widget _buildViewToggle() {
    const labels = ['Mensuel', 'Hebdo', 'Jour'];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      child: Container(
        height: 44,
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: _darkNavy.withValues(alpha: 0.06),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: List.generate(3, (i) {
            final selected = _viewIndex == i;
            return Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _viewIndex = i),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  decoration: BoxDecoration(
                    color: selected ? _darkNavy : Colors.transparent,
                    borderRadius: BorderRadius.circular(9),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    labels[i],
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: selected ? Colors.white : const Color(0xFF94A3B8),
                    ),
                  ),
                ),
              ),
            );
          }),
        ),
      ),
    );
  }

  // ─── FILTER ROW ────────────────────────────────────────────

  Widget _buildFilterRow() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      child: Row(
        children: [
          _filterChip(0, Icons.people_outline, 'Tous les ouvriers'),
          const SizedBox(width: 10),
          _filterChip(1, Icons.check_circle_outline, 'Chantiers actifs'),
        ],
      ),
    );
  }

  Widget _filterChip(int idx, IconData icon, String label) {
    final selected = _filterIndex == idx;
    return GestureDetector(
      onTap: () {
        setState(() => _filterIndex = idx);
        _load();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? _darkNavy : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? _darkNavy : const Color(0xFFE2E8F0),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: selected ? Colors.white : const Color(0xFF64748B)),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: selected ? Colors.white : const Color(0xFF64748B),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  MONTH VIEW
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Widget _buildMonthView() {
    const monthNames = [
      '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
    ];

    final eventsForDay = _eventsForSelectedDay;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Month header + nav
          Row(
            children: [
              Text(
                '${monthNames[_currentMonth.month]} ${_currentMonth.year}',
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: _darkNavy,
                ),
              ),
              const Spacer(),
              _navBtn(Icons.chevron_left, () {
                setState(() {
                  _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1);
                });
              }),
              const SizedBox(width: 6),
              _navBtn(Icons.chevron_right, () {
                setState(() {
                  _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1);
                });
              }),
            ],
          ),
          const SizedBox(height: 16),

          // Calendar grid
          _buildCalendarGrid(),

          const SizedBox(height: 24),

          // Day label
          Row(
            children: [
              Text(
                "Aujourd'hui, ${_selectedDay.day} ${monthNames[_selectedDay.month].substring(0, 3)}.",
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: _darkNavy,
                ),
              ),
              const Spacer(),
              Text(
                '${eventsForDay.length} chantier${eventsForDay.length != 1 ? 's' : ''}',
                style: const TextStyle(fontSize: 14, color: Color(0xFF94A3B8)),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Event cards for selected day
          if (eventsForDay.isEmpty)
            _buildEmptyDay()
          else
            ...eventsForDay.asMap().entries.map((entry) =>
                _buildEventCard(entry.value, entry.key)),

          const SizedBox(height: 80),
        ],
      ),
    );
  }

  Widget _buildCalendarGrid() {
    const dayHeaders = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
    final firstDay = DateTime(_currentMonth.year, _currentMonth.month, 1);
    final lastDay = DateTime(_currentMonth.year, _currentMonth.month + 1, 0);
    final startWeekday = firstDay.weekday; // 1=Mon
    final today = DateTime.now();
    final daysWithEvents = _daysWithEventsInMonth(_currentMonth.year, _currentMonth.month);

    List<Widget> cells = [];

    // Headers
    for (final d in dayHeaders) {
      cells.add(Center(
        child: Text(d,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: Color(0xFF94A3B8),
              letterSpacing: 0.4,
            )),
      ));
    }

    // Previous month padding
    for (int i = startWeekday - 1; i > 0; i--) {
      cells.add(const SizedBox.shrink());
    }

    // Current month days
    for (int day = 1; day <= lastDay.day; day++) {
      final isToday = today.day == day &&
          today.month == _currentMonth.month &&
          today.year == _currentMonth.year;
      final isSelected = _selectedDay.day == day &&
          _selectedDay.month == _currentMonth.month &&
          _selectedDay.year == _currentMonth.year;
      final hasEvent = daysWithEvents.contains(day);

      cells.add(GestureDetector(
        onTap: () => setState(() {
          _selectedDay = DateTime(_currentMonth.year, _currentMonth.month, day);
        }),
        child: Container(
          decoration: BoxDecoration(
            color: isSelected ? _darkNavy : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '$day',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: isSelected
                      ? Colors.white
                      : isToday
                          ? _blue
                          : _darkNavy,
                ),
              ),
              if (hasEvent && !isSelected)
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 4, height: 4,
                      margin: const EdgeInsets.only(top: 2, right: 1),
                      decoration: const BoxDecoration(color: _blue, shape: BoxShape.circle),
                    ),
                    Container(
                      width: 4, height: 4,
                      margin: const EdgeInsets.only(top: 2),
                      decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ));
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: _darkNavy.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: GridView.count(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisCount: 7,
        mainAxisSpacing: 4,
        crossAxisSpacing: 2,
        childAspectRatio: 1.0,
        children: cells,
      ),
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  WEEK VIEW
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Widget _buildWeekView() {
    const days = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
    final weekday = _selectedDay.weekday; // 1=Mon
    final weekStart = _selectedDay.subtract(Duration(days: weekday - 1));
    final eventsForDay = _eventsForSelectedDay;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Week strip
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(7, (i) {
              final date = weekStart.add(Duration(days: i));
              final isSelected = date.day == _selectedDay.day &&
                  date.month == _selectedDay.month;
              return GestureDetector(
                onTap: () => setState(() => _selectedDay = date),
                child: Column(
                  children: [
                    Text(days[i],
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: isSelected ? _darkNavy : const Color(0xFF94A3B8),
                        )),
                    const SizedBox(height: 6),
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: isSelected ? _darkNavy : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        '${date.day}',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: isSelected ? Colors.white : _darkNavy,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ),
          const SizedBox(height: 20),
          Text(
            '${eventsForDay.length} événement${eventsForDay.length != 1 ? 's' : ''}',
            style: const TextStyle(fontSize: 14, color: Color(0xFF94A3B8)),
          ),
          const SizedBox(height: 12),
          if (eventsForDay.isEmpty)
            _buildEmptyDay()
          else
            ...eventsForDay.asMap().entries.map((e) => _buildEventCard(e.value, e.key)),
          const SizedBox(height: 80),
        ],
      ),
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  DAY VIEW
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Widget _buildDayView() {
    final eventsForDay = _eventsForSelectedDay;
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Date nav
          Row(
            children: [
              _navBtn(Icons.chevron_left, () {
                setState(() => _selectedDay = _selectedDay.subtract(const Duration(days: 1)));
              }),
              const SizedBox(width: 10),
              Text(
                '${_selectedDay.day} / ${_selectedDay.month} / ${_selectedDay.year}',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: _darkNavy,
                ),
              ),
              const SizedBox(width: 10),
              _navBtn(Icons.chevron_right, () {
                setState(() => _selectedDay = _selectedDay.add(const Duration(days: 1)));
              }),
            ],
          ),
          const SizedBox(height: 16),
          if (eventsForDay.isEmpty)
            _buildEmptyDay()
          else
            ...eventsForDay.asMap().entries.map((e) => _buildEventCard(e.value, e.key)),
          const SizedBox(height: 80),
        ],
      ),
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  EVENT CARD (shared across all views)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Widget _buildEventCard(CalendarEvent event, int index) {
    final color = _eventColors[index % _eventColors.length];
    return GestureDetector(
      onTap: () async {
        await context.push('/calendrier/detail/${event.id}');
        _load();
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Time column
            SizedBox(
              width: 54,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    event.startTimeLabel,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: color,
                    ),
                  ),
                  Text(
                    event.durationLabel,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                  ),
                ],
              ),
            ),
            // Color bar
            Container(
              width: 4,
              height: 90,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 14),
            // Card
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      event.title,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: _darkNavy,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.person_outline, size: 13, color: Color(0xFF94A3B8)),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            event.clientName ?? '—',
                            style: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        // Worker avatars
                        ...event.workers.take(3).map((w) => _workerAvatar(w)),
                        if (event.workers.length > 3)
                          _countBadge(event.workers.length - 3),
                        const Spacer(),
                        if (event.status == 'En attente')
                          const Text('En attente',
                              style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _workerAvatar(CalendarEventWorker w) {
    return Container(
      width: 28,
      height: 28,
      margin: const EdgeInsets.only(right: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFE2E8F0),
        shape: BoxShape.circle,
        border: Border.all(color: Theme.of(context).colorScheme.surface, width: 2),
        image: w.profilePictureUrl != null
            ? DecorationImage(
                image: NetworkImage(w.profilePictureUrl!),
                fit: BoxFit.cover,
              )
            : null,
      ),
      child: w.profilePictureUrl == null
          ? Icon(Icons.person, size: 16, color: Colors.blueGrey[300])
          : null,
    );
  }

  Widget _countBadge(int count) {
    return Container(
      width: 28,
      height: 28,
      margin: const EdgeInsets.only(right: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFE2E8F0),
        shape: BoxShape.circle,
        border: Border.all(color: Theme.of(context).colorScheme.surface, width: 2),
      ),
      alignment: Alignment.center,
      child: Text('+$count',
          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _darkNavy)),
    );
  }

  Widget _buildEmptyDay() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Column(
          children: [
            Icon(Icons.calendar_today_outlined,
                size: 48, color: Colors.grey[300]),
            const SizedBox(height: 12),
            const Text(
              'Aucun événement ce jour',
              style: TextStyle(fontSize: 15, color: Color(0xFF94A3B8)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _navBtn(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(9),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Icon(icon, size: 20, color: _darkNavy),
      ),
    );
  }
}
