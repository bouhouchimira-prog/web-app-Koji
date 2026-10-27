import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/app/router_location.dart';
import 'package:koji/app/session_guard.dart';
import 'package:koji/apps/entreprise/entreprise_shell.dart';
import 'package:koji/core/route_args.dart';
import 'package:koji/features/archives/archives_screen.dart';
import 'package:koji/features/auth/business_info_screen.dart';
import 'package:koji/features/auth/koji_auth_screen.dart';
import 'package:koji/features/auth/profession_selection_screen.dart';
import 'package:koji/features/calendar/calendrier_screen.dart';
import 'package:koji/features/calendar/data/calendar_event_model.dart';
import 'package:koji/features/calendar/detail_planning_screen.dart';
import 'package:koji/features/calendar/nouvel_evenement_screen.dart';
import 'package:koji/features/fournitures/fournitures_screen.dart';
import 'package:koji/features/help/help_screen.dart';
import 'package:koji/features/home/home_screen.dart';
import 'package:koji/features/interventions/intervention_detail_screen.dart';
import 'package:koji/features/interventions/intervention_form_screen.dart';
import 'package:koji/features/interventions/intervention_list_screen.dart';
import 'package:koji/features/planning/planning_screen.dart';
import 'package:koji/features/profile/company_profile_screen.dart';
import 'package:koji/features/profile/my_signature_screen.dart';
import 'package:koji/features/quote/budget_category_detail_screen.dart';
import 'package:koji/features/quote/budget_history_screen.dart';
import 'package:koji/features/quote/chantier_add_task_screen.dart';
import 'package:koji/features/quote/chantier_afaire_screen.dart';
import 'package:koji/features/quote/chantier_budget_screen.dart';
import 'package:koji/features/quote/chantier_creation_screen.dart';
import 'package:koji/features/quote/chantier_dashboard_screen.dart';
import 'package:koji/features/quote/chantier_devis_screen.dart';
import 'package:koji/features/quote/chantier_documents_screen.dart';
import 'package:koji/features/quote/chantier_facturation_screen.dart';
import 'package:koji/features/quote/chantier_info_screen.dart';
import 'package:koji/features/quote/chantier_rdv_screen.dart';
import 'package:koji/features/quote/chantier_worker_activity_screen.dart';
import 'package:koji/features/quote/client_details_screen.dart';
import 'package:koji/features/quote/facturation_chantier_picker_screen.dart';
import 'package:koji/features/quote/facturation_create_screen.dart';
import 'package:koji/features/quote/ouvrage_library_screen.dart';
import 'package:koji/features/quote/photo_preview_screen.dart';
import 'package:koji/features/quote/quote_detail_screen.dart';
import 'package:koji/features/quote/quote_messages_inbox_screen.dart';
import 'package:koji/features/quote/quote_messages_screen.dart';
import 'package:koji/features/quote/quote_success_screen.dart';
import 'package:koji/features/quote/room_selection_screen.dart';
import 'package:koji/features/quote/room_task_screen.dart';
import 'package:koji/features/quote/visual_evidence_grid_screen.dart';
import 'package:koji/features/quote/visual_proof_screen.dart';
import 'package:koji/features/settings/pricing_settings_screen.dart';
import 'package:koji/features/splash/splash_screen.dart';
import 'package:koji/features/synchronization/ajouter_rdv_screen.dart';
import 'package:koji/features/synchronization/assignment_success_screen.dart';
import 'package:koji/features/synchronization/attendance_weekly_screen.dart';
import 'package:koji/features/synchronization/chantier_task_planning_screen.dart';
import 'package:koji/features/synchronization/create_worker_screen.dart';
import 'package:koji/features/synchronization/data/project_model.dart';
import 'package:koji/features/synchronization/data/worker_model.dart';
import 'package:koji/features/synchronization/nouveau_contact_screen.dart';
import 'package:koji/features/synchronization/pointage_heures_screen.dart';
import 'package:koji/features/synchronization/project_detail_screen.dart';
import 'package:koji/features/synchronization/project_selection_screen.dart';
import 'package:koji/features/synchronization/schedule_task_screen.dart';
import 'package:koji/features/synchronization/synchronization_screen.dart';
import 'package:koji/features/synchronization/worker_assignment_screen.dart';
import 'package:koji/features/synchronization/worker_detail_screen.dart';
import 'package:koji/features/synchronization/worker_list_screen.dart';
import 'package:koji/features/synchronization/worker_success_screen.dart';

// Routes of the entreprise app (Koji Pro). Start / onboarding pages are
// full-screen; every signed-in page is wrapped by [EntrepriseShell], which adds
// the top band + side menu of the web design on wide screens and keeps the
// entreprise background activity running.

// Fast fade between pages.
Page<dynamic> _buildPageWithTransition(
  BuildContext context,
  GoRouterState state,
  Widget child,
) {
  return CustomTransitionPage(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 150),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      return FadeTransition(
        opacity: CurveTween(curve: Curves.easeInOut).animate(animation),
        child: child,
      );
    },
  );
}

GoRouter buildEntrepriseRouter({bool requireSession = true}) => GoRouter(
      initialLocation: '/splash',
      redirect: requireSession
          ? kojiSessionGuard(const {'/splash', '/login', '/signup'})
          : null,
      routes: [
        GoRoute(
          path: '/splash',
          pageBuilder: (context, state) =>
              _buildPageWithTransition(context, state, const SplashScreen()),
        ),
        GoRoute(
          path: '/login',
          pageBuilder: (context, state) =>
              _buildPageWithTransition(context, state, const KojiAuthScreen()),
        ),
        GoRoute(
          path: '/signup',
          pageBuilder: (context, state) => _buildPageWithTransition(
            context,
            state,
            const KojiAuthScreen(initialTab: KojiAuthTab.signup),
          ),
        ),
        GoRoute(
          path: '/business-info',
          pageBuilder: (context, state) => _buildPageWithTransition(
            context,
            state,
            const BusinessInfoScreen(),
          ),
        ),
        GoRoute(
          path: '/profession-selection',
          pageBuilder: (context, state) => _buildPageWithTransition(
            context,
            state,
            const ProfessionSelectionScreen(),
          ),
        ),
        ShellRoute(
          builder: (context, state, child) => EntrepriseShell(
            location: currentRoutePath(GoRouter.of(context)),
            child: child,
          ),
          routes: [
            GoRoute(
              path: '/home',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const HomeScreen(),
              ),
            ),
            GoRoute(
              path: '/chantier/create',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const ChantierCreationScreen(),
              ),
            ),
            GoRoute(
              path: '/chantier/dashboard',
              pageBuilder: (context, state) {
                final data = state.extra as Map<String, dynamic>? ?? {};
                return _buildPageWithTransition(
                  context,
                  state,
                  ChantierDashboardScreen(data: data),
                );
              },
            ),
            GoRoute(
              path: '/chantier/info',
              pageBuilder: (context, state) {
                final data = state.extra as Map<String, dynamic>? ?? {};
                return _buildPageWithTransition(
                  context,
                  state,
                  ChantierInfoScreen(data: data),
                );
              },
            ),
            GoRoute(
              path: '/chantier/afaire',
              pageBuilder: (context, state) {
                final data = state.extra as Map<String, dynamic>? ?? {};
                return _buildPageWithTransition(
                  context,
                  state,
                  ChantierAFaireScreen(data: data),
                );
              },
            ),
            GoRoute(
              path: '/chantier/budget',
              pageBuilder: (context, state) {
                final data = state.extra as Map<String, dynamic>? ?? {};
                return _buildPageWithTransition(
                  context,
                  state,
                  ChantierBudgetScreen(data: data),
                );
              },
            ),
            GoRoute(
              path: '/chantier/budget/detail',
              pageBuilder: (context, state) {
                final data = state.extra as Map<String, dynamic>? ?? {};
                return _buildPageWithTransition(
                  context,
                  state,
                  BudgetCategoryDetailScreen(data: data),
                );
              },
            ),
            GoRoute(
              path: '/chantier/budget/history',
              pageBuilder: (context, state) {
                final data = state.extra as Map<String, dynamic>? ?? {};
                return _buildPageWithTransition(
                  context,
                  state,
                  BudgetHistoryScreen(data: data),
                );
              },
            ),
            GoRoute(
              path: '/chantier/devis',
              pageBuilder: (context, state) {
                final data = state.extra as Map<String, dynamic>? ?? {};
                return _buildPageWithTransition(
                  context,
                  state,
                  ChantierDevisScreen(data: data),
                );
              },
            ),
            GoRoute(
              path: '/facturation',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const FacturationChantierPickerScreen(),
              ),
            ),
            GoRoute(
              path: '/chantier/facturation',
              pageBuilder: (context, state) {
                final data = state.extra as Map<String, dynamic>? ?? {};
                return _buildPageWithTransition(
                  context,
                  state,
                  ChantierFacturationScreen(data: data),
                );
              },
            ),
            GoRoute(
              path: '/chantier/facturation/create',
              pageBuilder: (context, state) {
                final args = state.extra as Map<String, dynamic>? ?? {};
                return _buildPageWithTransition(
                  context,
                  state,
                  FacturationCreateScreen(args: args),
                );
              },
            ),
            GoRoute(
              path: '/chantier/rdv',
              pageBuilder: (context, state) {
                final data = state.extra as Map<String, dynamic>? ?? {};
                return _buildPageWithTransition(
                  context,
                  state,
                  ChantierRdvScreen(data: data),
                );
              },
            ),
            GoRoute(
              path: '/chantier/add-task',
              pageBuilder: (context, state) {
                final data = state.extra as Map<String, dynamic>? ?? {};
                return _buildPageWithTransition(
                  context,
                  state,
                  ChantierAddTaskScreen(data: data),
                );
              },
            ),
            GoRoute(
              path: '/chantier/documents',
              pageBuilder: (context, state) {
                final data = state.extra as Map<String, dynamic>? ?? {};
                return _buildPageWithTransition(
                  context,
                  state,
                  ChantierDocumentsScreen(data: data),
                );
              },
            ),
            GoRoute(
              path: '/chantier/worker-activity',
              pageBuilder: (context, state) {
                final data = state.extra as Map<String, dynamic>? ?? {};
                return _buildPageWithTransition(
                  context,
                  state,
                  ChantierWorkerActivityScreen(data: data),
                );
              },
            ),
            GoRoute(
              path: '/quote/client-details',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const ClientDetailsScreen(),
              ),
            ),
            GoRoute(
              path: '/quote/visual-proofs',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const VisualProofScreen(),
              ),
            ),
            GoRoute(
              path: '/quote/visual-evidence-grid',
              pageBuilder: (context, state) {
                final images = state.extra as List<String>? ?? [];
                return _buildPageWithTransition(
                  context,
                  state,
                  VisualEvidenceGridScreen(initialImages: images),
                );
              },
            ),
            GoRoute(
              path: '/quote/room-selection',
              pageBuilder: (context, state) {
                final images = state.extra as List<String>? ?? [];
                return _buildPageWithTransition(
                  context,
                  state,
                  RoomSelectionScreen(initialImages: images),
                );
              },
            ),
            GoRoute(
              path: '/quote/room-details',
              pageBuilder: (context, state) {
                // Accept either the typed QuoteRoomArgs or a legacy Map for backwards-compat
                final extra = state.extra;
                late List<String> roomIds;
                late List<String> images;
                if (extra is QuoteRoomArgs) {
                  roomIds = extra.roomIds;
                  images = extra.images;
                } else {
                  final map = extra as Map<String, dynamic>? ?? {};
                  roomIds = map['roomIds'] as List<String>? ?? [];
                  images = map['images'] as List<String>? ?? [];
                }
                return _buildPageWithTransition(
                  context,
                  state,
                  RoomTaskScreen(selectedRoomIds: roomIds, images: images),
                );
              },
            ),
            GoRoute(
              path: '/quote/photo-preview',
              pageBuilder: (context, state) {
                final imagePath = state.uri.queryParameters['imagePath'];
                return _buildPageWithTransition(
                  context,
                  state,
                  PhotoPreviewScreen(imagePath: imagePath),
                );
              },
            ),
            GoRoute(
              path: '/quote/detail',
              pageBuilder: (context, state) {
                final extra = state.extra;
                final data = extra is QuoteDetailArgs
                    ? extra.data
                    : extra as Map<String, dynamic>? ?? {};
                return _buildPageWithTransition(
                  context,
                  state,
                  QuoteDetailScreen(data: data),
                );
              },
            ),
            GoRoute(
              path: '/quote/success',
              pageBuilder: (context, state) {
                final extra = state.extra;
                late String quoteId;
                late Map<String, dynamic> quoteData;
                if (extra is QuoteSuccessArgs) {
                  quoteId = extra.quoteId;
                  quoteData = extra.quoteData;
                } else {
                  final map = extra as Map<String, dynamic>? ?? {};
                  quoteId = map['quoteId'] as String? ?? '';
                  quoteData = map['quoteData'] as Map<String, dynamic>? ?? {};
                }
                return _buildPageWithTransition(
                  context,
                  state,
                  QuoteSuccessScreen(
                    quoteId: quoteId,
                    quoteData: quoteData,
                  ),
                );
              },
            ),
            GoRoute(
              path: '/quote/messages',
              pageBuilder: (context, state) {
                final map = state.extra as Map<String, dynamic>? ?? {};
                final quoteId = map['quoteId'] as String? ?? '';
                final clientName = map['clientName'] as String?;
                return _buildPageWithTransition(
                  context,
                  state,
                  QuoteMessagesScreen(quoteId: quoteId, clientName: clientName),
                );
              },
            ),
            GoRoute(
              path: '/messages',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const QuoteMessagesInboxScreen(),
              ),
            ),
            GoRoute(
              path: '/fournitures',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const FournituresScreen(),
              ),
            ),
            GoRoute(
              path: '/archives',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const ArchivesScreen(),
              ),
            ),
            // Interventions Routes
            GoRoute(
              path: '/interventions',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const InterventionListScreen(),
              ),
            ),
            GoRoute(
              path: '/interventions/new',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const InterventionFormScreen(),
              ),
            ),
            GoRoute(
              path: '/interventions/detail',
              pageBuilder: (context, state) {
                final id = state.extra as String? ?? '';
                return _buildPageWithTransition(
                  context,
                  state,
                  InterventionDetailScreen(interventionId: id),
                );
              },
            ),
            GoRoute(
              path: '/signature',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const MySignatureScreen(),
              ),
            ),
            // Synchronization Routes
            GoRoute(
              path: '/synchronization',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const SynchronizationScreen(),
              ),
            ),
            GoRoute(
              path: '/synchronization/pointage',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const PointageHeuresScreen(),
              ),
            ),
            GoRoute(
              path: '/synchronization/pointage/new-contact',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const NouveauContactScreen(),
              ),
            ),
            GoRoute(
              path: '/synchronization/pointage/rdv',
              pageBuilder: (context, state) {
                final worker = state.extra as Worker?;
                return _buildPageWithTransition(
                  context,
                  state,
                  AjouterRdvScreen(worker: worker),
                );
              },
            ),
            GoRoute(
              path: '/synchronization/pointage/attendance',
              pageBuilder: (context, state) {
                final worker = state.extra as Worker;
                return _buildPageWithTransition(
                  context,
                  state,
                  AttendanceWeeklyScreen(worker: worker),
                );
              },
            ),
            GoRoute(
              path: '/synchronization/plan-tasks',
              pageBuilder: (context, state) {
                final args = state.extra as Map<String, dynamic>?;
                return _buildPageWithTransition(
                  context,
                  state,
                  ChantierTaskPlanningScreen(
                    initialChantierId: args?['chantierId'] as String?,
                  ),
                );
              },
            ),
            GoRoute(
              path: '/synchronization/schedule-task',
              pageBuilder: (context, state) {
                final args = state.extra as Map<String, dynamic>?;
                return _buildPageWithTransition(
                  context,
                  state,
                  ScheduleTaskScreen(
                    chantierId: args?['chantierId'] as String?,
                    chantierTaskId: args?['chantierTaskId'] as String?,
                    editingTaskId: args?['editingTaskId'] as String?,
                    initialDate: args?['initialDate'] as DateTime?,
                    initialTitle: args?['initialTitle'] as String?,
                    initialWorkerId: args?['initialWorkerId'] as String?,
                  ),
                );
              },
            ),
            // Worker Routes
            GoRoute(
              path: '/workers',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const WorkerListScreen(),
              ),
            ),
            GoRoute(
              path: '/workers/create',
              pageBuilder: (context, state) {
                final worker = state.extra as Worker?;
                return _buildPageWithTransition(
                  context,
                  state,
                  CreateWorkerScreen(worker: worker),
                );
              },
            ),
            GoRoute(
              path: '/workers/success',
              pageBuilder: (context, state) {
                final worker = state.extra as Worker?;
                return _buildPageWithTransition(
                  context,
                  state,
                  WorkerSuccessScreen(worker: worker),
                );
              },
            ),
            GoRoute(
              path: '/workers/detail',
              pageBuilder: (context, state) {
                // SAFETY FIX: the old code did `state.extra as Worker` (non-nullable).
                // If the caller forgot to pass a Worker, this would throw a ClassCastException
                // at runtime with no helpful error. We now do a safe nullable cast and log a
                // warning instead of crashing.
                final worker = state.extra as Worker?;
                assert(worker != null,
                    '/workers/detail was pushed without a Worker argument');
                if (worker == null) {
                  // Graceful fallback: pop back instead of crashing.
                  return _buildPageWithTransition(
                    context,
                    state,
                    const SizedBox.shrink(),
                  );
                }
                return _buildPageWithTransition(
                  context,
                  state,
                  WorkerDetailScreen(worker: worker),
                );
              },
            ),
            // Project Assignment Routes
            GoRoute(
              path: '/projects',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const ProjectSelectionScreen(),
              ),
            ),
            GoRoute(
              path: '/projects/detail/:projectId',
              pageBuilder: (context, state) {
                final projectId = state.pathParameters['projectId']!;
                final project = state.extra as Project?;
                return _buildPageWithTransition(
                  context,
                  state,
                  ProjectDetailScreen(projectId: projectId, project: project),
                );
              },
            ),
            GoRoute(
              path: '/projects/assign/:projectId',
              pageBuilder: (context, state) {
                final extra = state.extra;
                if (extra is! Project) {
                  return _buildPageWithTransition(
                    context,
                    state,
                    const ProjectSelectionScreen(),
                  );
                }
                final project = extra;
                return _buildPageWithTransition(
                  context,
                  state,
                  WorkerAssignmentScreen(project: project),
                );
              },
            ),
            GoRoute(
              path: '/projects/success',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const AssignmentSuccessScreen(),
              ),
            ),
            GoRoute(
              path: '/planning',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const PlanningScreen(),
              ),
            ),
            // ── Calendar routes ──────────────────────────────────────
            GoRoute(
              path: '/calendrier',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const CalendrierScreen(),
              ),
            ),
            GoRoute(
              path: '/calendrier/new-event',
              pageBuilder: (context, state) {
                // When coming from edit button, extra is a CalendarEvent to pre-fill
                final initial = state.extra as CalendarEvent?;
                return _buildPageWithTransition(
                  context,
                  state,
                  NouvelEvenementScreen(initialEvent: initial),
                );
              },
            ),
            GoRoute(
              path: '/calendrier/detail/:eventId',
              pageBuilder: (context, state) {
                final eventId = state.pathParameters['eventId']!;
                return _buildPageWithTransition(
                  context,
                  state,
                  DetailPlanningScreen(eventId: eventId),
                );
              },
            ),
            // Bibliothèque d'ouvrages (reusable works catalogue)
            GoRoute(
              path: '/ouvrage-library',
              pageBuilder: (context, state) {
                final extra = state.extra;
                final pickMode = extra is Map && extra['pickMode'] == true;
                return _buildPageWithTransition(
                  context,
                  state,
                  OuvrageLibraryScreen(pickMode: pickMode),
                );
              },
            ),
            // Settings Routes
            GoRoute(
              path: '/settings/pricing',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const PricingSettingsScreen(),
              ),
            ),
            // Profile Routes
            GoRoute(
              path: '/profile/company',
              pageBuilder: (context, state) => _buildPageWithTransition(
                context,
                state,
                const CompanyProfileScreen(),
              ),
            ),
            GoRoute(
              path: '/aide',
              pageBuilder: (context, state) => _buildPageWithTransition(
                  context, state, const KojiHelpScreen()),
            ),
          ],
        ),
      ],
    );
