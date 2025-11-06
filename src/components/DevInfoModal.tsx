import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings, getProgramTheme, ProgramType } from '../contexts/SettingsContext';
import { robotEventsAPI } from '../services/apiRouter';
import { PROGRAM_CONFIGS, getAllProgramNames } from '../utils/programMappings';

interface DevInfoModalProps {
  visible: boolean;
  onClose: () => void;
}

interface GradeBreakdown {
  grade: string;
  registeredCount: number;
  totalCount: number;
}

interface ProgramSeasons {
  [program: string]: {
    seasons: {label: string, value: string}[];
    activeSeason: {id: number, name: string} | null;
    totalRegisteredTeams: number | null;
    totalAllTimeTeams: number | null;
    gradeBreakdown: GradeBreakdown[];
  };
}

const DevInfoModal: React.FC<DevInfoModalProps> = ({ visible, onClose }) => {
  const settings = useSettings();
  const [loading, setLoading] = useState(false);
  const [programSeasons, setProgramSeasons] = useState<ProgramSeasons>({});
  const [allPrograms, setAllPrograms] = useState<string[]>([]);

  useEffect(() => {
    if (visible) {
      fetchAllProgramsAndSeasons();
    }
  }, [visible]);

  const fetchAllProgramsAndSeasons = async () => {
    setLoading(true);
    try {
      const programs = getAllProgramNames();
      setAllPrograms(programs);

      const programSeasonsData: ProgramSeasons = {};

      // Fetch seasons and team counts for each program in parallel
      // Note: robotEventsAPI.getSeasons() and getCurrentSeasonId() automatically route to the correct API
      // based on the program's apiType configuration in programMappings.ts
      await Promise.all(
        programs.map(async (program) => {
          try {
            // Get program config to check API type
            const config = PROGRAM_CONFIGS[program];

            // Get seasons list - apiRouter will automatically use correct API for this program
            const seasonsResponse = await robotEventsAPI.getSeasons({ program: [config.id] });
            const formattedSeasons = seasonsResponse.data.map((season: any) => ({
              label: season.name,
              value: season.id.toString()
            }));

            // Get current season - apiRouter will automatically use correct API for this program
            const seasonId = await robotEventsAPI.getCurrentSeasonId(program as ProgramType);
            const seasonData = formattedSeasons.find((s: any) => s.value === seasonId.toString());

            // Get total registered teams count - fetch first page only to get meta.total
            let totalRegisteredTeams: number | null = null;
            try {
              const registeredTeamsResponse = await robotEventsAPI.getTeams({ program: [config.id], registered: true, per_page: 1 });
              totalRegisteredTeams = registeredTeamsResponse.meta?.total || null;
            } catch (error) {
              console.error(`Failed to fetch registered team count for ${program}:`, error);
            }

            // Get total all-time teams count (registered and unregistered)
            let totalAllTimeTeams: number | null = null;
            try {
              const allTeamsResponse = await robotEventsAPI.getTeams({ program: [config.id], per_page: 1 });
              totalAllTimeTeams = allTeamsResponse.meta?.total || null;
            } catch (error) {
              console.error(`Failed to fetch all-time team count for ${program}:`, error);
            }

            // Get breakdown by grade level
            const gradeBreakdown: GradeBreakdown[] = [];
            for (const grade of config.availableGrades) {
              try {
                // Get registered count for this grade
                const registeredByGradeResponse = await robotEventsAPI.getTeams({
                  program: [config.id],
                  grade: [grade as any],
                  registered: true,
                  per_page: 1
                });
                const registeredCount = registeredByGradeResponse.meta?.total || 0;

                // Get total count for this grade
                const totalByGradeResponse = await robotEventsAPI.getTeams({
                  program: [config.id],
                  grade: [grade as any],
                  per_page: 1
                });
                const totalCount = totalByGradeResponse.meta?.total || 0;

                gradeBreakdown.push({
                  grade,
                  registeredCount,
                  totalCount
                });
              } catch (error) {
                console.error(`Failed to fetch team counts for ${program} - ${grade}:`, error);
              }
            }

            programSeasonsData[program] = {
              seasons: formattedSeasons,
              activeSeason: {
                id: seasonId,
                name: seasonData?.label || 'Unknown'
              },
              totalRegisteredTeams,
              totalAllTimeTeams,
              gradeBreakdown
            };
          } catch (error) {
            console.error(`Failed to fetch data for ${program}:`, error);
            programSeasonsData[program] = {
              seasons: [],
              activeSeason: null,
              totalRegisteredTeams: null,
              totalAllTimeTeams: null,
              gradeBreakdown: []
            };
          }
        })
      );

      setProgramSeasons(programSeasonsData);
    } catch (error) {
      console.error('Failed to fetch programs and seasons:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderInfoRow = (label: string, value: string) => (
    <View style={[styles.infoRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
      <Text style={[styles.infoLabel, { color: settings.secondaryTextColor }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: settings.textColor }]}>{value}</Text>
    </View>
  );

  const renderColorRow = (label: string, colorValue: string) => (
    <View style={[styles.infoRow, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
      <Text style={[styles.infoLabel, { color: settings.secondaryTextColor }]}>{label}</Text>
      <View style={[styles.colorValueContainer, { borderColor: settings.borderColor }]}>
        <Text style={[styles.colorValue, { color: colorValue }]}>{colorValue}</Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: settings.backgroundColor }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: settings.cardBackgroundColor, borderBottomColor: settings.borderColor }]}>
          <Text style={[styles.headerTitle, { color: settings.textColor }]}>Developer Information</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={settings.textColor} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={settings.buttonColor} />
            <Text style={[styles.loadingText, { color: settings.secondaryTextColor }]}>
              Loading programs and seasons...
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.content}>
            {/* App Information */}
            <Text style={[styles.sectionTitle, { color: settings.textColor }]}>
              App Information
            </Text>
            {renderInfoRow('Platform', Platform.OS)}
            {renderInfoRow('Platform Version', Platform.Version.toString())}
            {renderInfoRow('Developer Mode', settings.isDeveloperMode ? 'Enabled' : 'Disabled')}
            {renderInfoRow('Color Scheme', settings.colorScheme || 'light')}
            {renderInfoRow('Selected Program', settings.selectedProgram)}

            {/* Current Season Information */}
            <Text style={[styles.sectionTitle, { color: settings.textColor }]}>
              Current Season Settings
            </Text>
            {renderInfoRow('Global Season Enabled', settings.globalSeasonEnabled ? 'Yes' : 'No')}
            {settings.globalSeasonEnabled && settings.selectedSeason && programSeasons[settings.selectedProgram] && (() => {
              const seasonData = programSeasons[settings.selectedProgram].seasons.find(s => s.value === settings.selectedSeason);
              return (
                <>
                  {renderInfoRow('Global Selected Season', seasonData?.label || 'N/A')}
                  {renderInfoRow('Global Selected Season ID', settings.selectedSeason || 'N/A')}
                </>
              );
            })()}

            {/* All Programs Information */}
            <Text style={[styles.sectionTitle, { color: settings.textColor }]}>
              All Programs ({allPrograms.length})
            </Text>
            {allPrograms.map((program) => {
              const config = PROGRAM_CONFIGS[program as ProgramType];
              const programData = programSeasons[program];

              return (
                <View key={program} style={[styles.programCard, { backgroundColor: settings.cardBackgroundColor, borderColor: settings.borderColor }]}>
                  <View style={styles.programHeader}>
                    <Text style={[styles.programName, { color: settings.textColor }]}>
                      {program}
                      {config?.devOnly && <Text style={[styles.devBadge, { color: '#FF9800' }]}> (Dev Only)</Text>}
                    </Text>
                  </View>

                  <View style={styles.programDetails}>
                    {config && (
                      <>
                        <Text style={[styles.programDetailText, { color: settings.secondaryTextColor }]}>
                          ID: {config.id}
                        </Text>
                        <Text style={[styles.programDetailText, { color: settings.secondaryTextColor }]}>
                          API: {config.apiType}
                        </Text>
                        <Text style={[styles.programDetailText, { color: settings.secondaryTextColor }]}>
                          Grades: {config.availableGrades.join(', ')}
                        </Text>
                        <Text style={[styles.programDetailText, { color: settings.secondaryTextColor }]}>
                          Match Format: {config.matchFormat || 'N/A'}
                        </Text>
                        <Text style={[styles.programDetailText, { color: settings.secondaryTextColor }]}>
                          Use Themed Colors: {config.useThemedScoreColors ? 'Yes' : 'No'}
                        </Text>
                      </>
                    )}

                    {programData && (
                      <>
                        <Text style={[styles.programDetailText, { color: settings.secondaryTextColor, marginTop: 8 }]}>
                          Total Seasons: {programData.seasons.length}
                        </Text>
                        {programData.activeSeason && (
                          <Text style={[styles.programDetailText, { color: settings.textColor, fontWeight: '600' }]}>
                            Active Season: {programData.activeSeason.name} (ID: {programData.activeSeason.id})
                          </Text>
                        )}
                        {programData.totalRegisteredTeams !== null && (
                          <Text style={[styles.programDetailText, { color: settings.textColor, fontWeight: '600', marginTop: 4 }]}>
                            Currently Registered Teams: {programData.totalRegisteredTeams.toLocaleString()}
                          </Text>
                        )}
                        {programData.totalAllTimeTeams !== null && (
                          <Text style={[styles.programDetailText, { color: settings.secondaryTextColor }]}>
                            Total Teams Created: {programData.totalAllTimeTeams.toLocaleString()}
                          </Text>
                        )}

                        {/* Grade Level Breakdown */}
                        {programData.gradeBreakdown.length > 0 && (
                          <>
                            <Text style={[styles.programDetailText, { color: settings.secondaryTextColor, marginTop: 8, fontWeight: '600' }]}>
                              Breakdown by Grade Level:
                            </Text>
                            {programData.gradeBreakdown.map((gradeData) => (
                              <View key={gradeData.grade} style={styles.gradeBreakdownRow}>
                                <Text style={[styles.gradeBreakdownGrade, { color: settings.secondaryTextColor }]}>
                                  {gradeData.grade}:
                                </Text>
                                <View style={styles.gradeBreakdownCounts}>
                                  <Text style={[styles.gradeBreakdownText, { color: settings.textColor }]}>
                                    {gradeData.registeredCount.toLocaleString()} registered
                                  </Text>
                                  <Text style={[styles.gradeBreakdownSeparator, { color: settings.secondaryTextColor }]}>
                                    {' / '}
                                  </Text>
                                  <Text style={[styles.gradeBreakdownText, { color: settings.secondaryTextColor }]}>
                                    {gradeData.totalCount.toLocaleString()} total
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </View>

                  {/* Program Theme Colors */}
                  {(() => {
                    const lightTheme = getProgramTheme(program as ProgramType, 'light');
                    const darkTheme = getProgramTheme(program as ProgramType, 'dark');
                    const programOverrides = settings.programColorOverrides[program as ProgramType];
                    const primaryOverride = programOverrides?.find(o => o.property === 'primary');

                    return (
                      <View style={styles.programColors}>
                        <Text style={[styles.programColorsTitle, { color: settings.secondaryTextColor }]}>
                          Theme Colors:
                        </Text>

                        {/* Default Colors */}
                        <Text style={[styles.colorSubtitle, { color: settings.secondaryTextColor }]}>Default:</Text>
                        <View style={styles.themeRow}>
                          <Text style={[styles.themeLabel, { color: settings.secondaryTextColor }]}>Light Mode:</Text>
                          <View style={[styles.colorValueContainer, { borderColor: settings.borderColor }]}>
                            <Text style={[styles.colorValue, { color: lightTheme.primary }]}>
                              Primary: {lightTheme.primary}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.themeRow}>
                          <Text style={[styles.themeLabel, { color: settings.secondaryTextColor }]}>Dark Mode:</Text>
                          <View style={[styles.colorValueContainer, { borderColor: settings.borderColor }]}>
                            <Text style={[styles.colorValue, { color: darkTheme.primary }]}>
                              Primary: {darkTheme.primary}
                            </Text>
                          </View>
                        </View>

                        {/* Active Overrides */}
                        {primaryOverride && (
                          <>
                            <Text style={[styles.colorSubtitle, { color: '#FF9800', marginTop: 8 }]}>
                              Active Overrides:
                            </Text>
                            {primaryOverride.lightModeValue && (
                              <View style={styles.themeRow}>
                                <Text style={[styles.themeLabel, { color: settings.secondaryTextColor }]}>Light Mode:</Text>
                                <View style={[styles.colorValueContainer, { borderColor: settings.borderColor }]}>
                                  <Text style={[styles.colorValue, { color: primaryOverride.lightModeValue }]}>
                                    Primary: {primaryOverride.lightModeValue}
                                  </Text>
                                </View>
                              </View>
                            )}
                            {primaryOverride.darkModeValue && (
                              <View style={styles.themeRow}>
                                <Text style={[styles.themeLabel, { color: settings.secondaryTextColor }]}>Dark Mode:</Text>
                                <View style={[styles.colorValueContainer, { borderColor: settings.borderColor }]}>
                                  <Text style={[styles.colorValue, { color: primaryOverride.darkModeValue }]}>
                                    Primary: {primaryOverride.darkModeValue}
                                  </Text>
                                </View>
                              </View>
                            )}
                          </>
                        )}
                      </View>
                    );
                  })()}

                  {/* Seasons List */}
                  {programData && programData.seasons.length > 0 && (
                    <View style={styles.seasonsList}>
                      <Text style={[styles.seasonsListTitle, { color: settings.secondaryTextColor }]}>
                        All Seasons:
                      </Text>
                      {programData.seasons.map((season, index) => {
                        const isActive = season.value === programData.activeSeason?.id.toString();
                        return (
                          <Text
                            key={season.value}
                            style={[
                              styles.seasonItem,
                              { color: isActive ? settings.buttonColor : settings.secondaryTextColor }
                            ]}
                          >
                            {season.label} (ID: {season.value}){isActive ? ' ⭐' : ''}
                          </Text>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Feature Flags */}
            <Text style={[styles.sectionTitle, { color: settings.textColor }]}>
              Feature Flags
            </Text>
            {renderInfoRow('Live Event Simulation', settings.devLiveEventSimulation ? 'Enabled' : 'Disabled')}
            {renderInfoRow('All Around Eligibility', settings.allAroundEligibilityEnabled ? 'Enabled' : 'Disabled')}
            {renderInfoRow('Testing Eligibility', settings.testingEligibilityEnabled ? 'Enabled' : 'Disabled')}
            {renderInfoRow('Eligibility Warning Dismissed', settings.eligibilityWarningDismissed ? 'Yes' : 'No')}
            {renderInfoRow('Show Awards Summary', settings.showAwardsSummary ? 'Yes' : 'No')}
            {renderInfoRow('Dev Programs Enabled', settings.devOnlyProgramsEnabled ? 'Yes' : 'No')}
            {renderInfoRow('VEX Program Score Calculators', settings.scoringCalculatorsEnabled ? 'Yes' : 'No')}

            {/* UI Settings */}
            <Text style={[styles.sectionTitle, { color: settings.textColor }]}>
              UI Settings
            </Text>
            {renderColorRow('Top Bar Color', settings.topBarColor)}
            {renderColorRow('Top Bar Content Color', settings.topBarContentColor)}
            {renderColorRow('Button Color', settings.buttonColor)}
            {renderColorRow('Card Background Color', settings.cardBackgroundColor)}
            {renderColorRow('Background Color', settings.backgroundColor)}
            {renderColorRow('Text Color', settings.textColor)}
            {renderColorRow('Secondary Text Color', settings.secondaryTextColor)}
            {renderColorRow('Border Color', settings.borderColor)}
            {renderColorRow('Icon Color', settings.iconColor)}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 15,
    flex: 1,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  programCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  programHeader: {
    marginBottom: 12,
  },
  programName: {
    fontSize: 18,
    fontWeight: '600',
  },
  devBadge: {
    fontSize: 14,
    fontWeight: '500',
  },
  programDetails: {
    marginBottom: 12,
  },
  programDetailText: {
    fontSize: 14,
    marginBottom: 4,
  },
  programColors: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  programColorsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  colorSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  themeLabel: {
    fontSize: 13,
    width: 90,
  },
  colorValueContainer: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  colorValue: {
    fontSize: 13,
  },
  seasonsList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  seasonsListTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  seasonItem: {
    fontSize: 13,
    marginBottom: 4,
    paddingLeft: 12,
  },
  gradeBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingLeft: 12,
  },
  gradeBreakdownGrade: {
    fontSize: 13,
    width: 100,
  },
  gradeBreakdownCounts: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  gradeBreakdownText: {
    fontSize: 13,
  },
  gradeBreakdownSeparator: {
    fontSize: 13,
  },
});

export default DevInfoModal;
