import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type EventType = 'goal' | 'penalty' | 'corner' | 'substitution' | 'yellow_card' | 'red_card';
type MatchStatus = 'not_started' | 'first_half' | 'half_time' | 'second_half' | 'finished';
type Team = 'home' | 'away';

interface MatchEvent {
  id: string;
  event_type: EventType;
  team: Team;
  minute: number;
  player_name?: string;
  player_out?: string;
  player_in?: string;
  notes?: string;
  timestamp: string;
}

interface Match {
  id: string;
  home_team: string;
  away_team: string;
  date: string;
  status: MatchStatus;
  current_minute: number;
  home_score: number;
  away_score: number;
  home_corners: number;
  away_corners: number;
  home_penalties: number;
  away_penalties: number;
  home_substitutions: number;
  away_substitutions: number;
  home_yellow_cards: number;
  away_yellow_cards: number;
  home_red_cards: number;
  away_red_cards: number;
  events: MatchEvent[];
}

type Screen = 'home' | 'match' | 'summary';

export default function Index() {
  const [screen, setScreen] = useState<Screen>('home');
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // New match modal
  const [showNewMatchModal, setShowNewMatchModal] = useState(false);
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  
  // Event modal
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState<EventType | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team>('home');
  const [eventMinute, setEventMinute] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerOut, setPlayerOut] = useState('');
  const [playerIn, setPlayerIn] = useState('');

  const fetchMatches = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/matches`);
      if (response.ok) {
        const data = await response.json();
        setMatches(data);
      }
    } catch (error) {
      console.error('Error fetching matches:', error);
    }
  }, []);

  const fetchMatch = useCallback(async (matchId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/matches/${matchId}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentMatch(data);
      }
    } catch (error) {
      console.error('Error fetching match:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMatches();
    setRefreshing(false);
  }, [fetchMatches]);

  const createMatch = async () => {
    if (!homeTeam.trim() || !awayTeam.trim()) {
      Alert.alert('Error', 'Por favor ingresa ambos equipos');
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          home_team: homeTeam.trim(),
          away_team: awayTeam.trim(),
        }),
      });
      
      if (response.ok) {
        const newMatch = await response.json();
        setCurrentMatch(newMatch);
        setShowNewMatchModal(false);
        setHomeTeam('');
        setAwayTeam('');
        setScreen('match');
        fetchMatches();
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear el partido');
    } finally {
      setLoading(false);
    }
  };

  const updateMatchStatus = async (status: MatchStatus) => {
    if (!currentMatch) return;
    
    try {
      const response = await fetch(`${API_URL}/api/matches/${currentMatch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      
      if (response.ok) {
        const updatedMatch = await response.json();
        setCurrentMatch(updatedMatch);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el estado');
    }
  };

  const addEvent = async () => {
    if (!currentMatch || !selectedEventType || !eventMinute) {
      Alert.alert('Error', 'Por favor completa los campos requeridos');
      return;
    }
    
    try {
      setLoading(true);
      const eventData: any = {
        event_type: selectedEventType,
        team: selectedTeam,
        minute: parseInt(eventMinute, 10),
      };
      
      if (selectedEventType === 'substitution') {
        eventData.player_out = playerOut;
        eventData.player_in = playerIn;
      } else if (playerName) {
        eventData.player_name = playerName;
      }
      
      const response = await fetch(`${API_URL}/api/matches/${currentMatch.id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });
      
      if (response.ok) {
        const updatedMatch = await response.json();
        setCurrentMatch(updatedMatch);
        closeEventModal();
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo agregar el evento');
    } finally {
      setLoading(false);
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!currentMatch) return;
    
    Alert.alert(
      'Confirmar',
      '¿Eliminar este evento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `${API_URL}/api/matches/${currentMatch.id}/events/${eventId}`,
                { method: 'DELETE' }
              );
              if (response.ok) {
                const updatedMatch = await response.json();
                setCurrentMatch(updatedMatch);
              }
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar el evento');
            }
          },
        },
      ]
    );
  };

  const deleteMatch = async (matchId: string) => {
    Alert.alert(
      'Confirmar',
      '¿Eliminar este partido?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${API_URL}/api/matches/${matchId}`, { method: 'DELETE' });
              fetchMatches();
              if (currentMatch?.id === matchId) {
                setCurrentMatch(null);
                setScreen('home');
              }
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar el partido');
            }
          },
        },
      ]
    );
  };

  const openEventModal = (eventType: EventType, team: Team) => {
    setSelectedEventType(eventType);
    setSelectedTeam(team);
    setEventMinute(currentMatch?.current_minute?.toString() || '0');
    setPlayerName('');
    setPlayerOut('');
    setPlayerIn('');
    setShowEventModal(true);
  };

  const closeEventModal = () => {
    setShowEventModal(false);
    setSelectedEventType(null);
    setEventMinute('');
    setPlayerName('');
    setPlayerOut('');
    setPlayerIn('');
  };

  const getEventIcon = (eventType: EventType): keyof typeof Ionicons.glyphMap => {
    switch (eventType) {
      case 'goal': return 'football';
      case 'penalty': return 'flag';
      case 'corner': return 'flag-outline';
      case 'substitution': return 'swap-horizontal';
      case 'yellow_card': return 'square';
      case 'red_card': return 'square';
      default: return 'ellipse';
    }
  };

  const getEventColor = (eventType: EventType): string => {
    switch (eventType) {
      case 'goal': return '#4CAF50';
      case 'penalty': return '#FF9800';
      case 'corner': return '#2196F3';
      case 'substitution': return '#9C27B0';
      case 'yellow_card': return '#FFEB3B';
      case 'red_card': return '#F44336';
      default: return '#757575';
    }
  };

  const getEventLabel = (eventType: EventType): string => {
    switch (eventType) {
      case 'goal': return 'Gol';
      case 'penalty': return 'Penal';
      case 'corner': return 'Esquina';
      case 'substitution': return 'Cambio';
      case 'yellow_card': return 'Amarilla';
      case 'red_card': return 'Roja';
      default: return eventType;
    }
  };

  const getStatusLabel = (status: MatchStatus): string => {
    switch (status) {
      case 'not_started': return 'Sin iniciar';
      case 'first_half': return '1er Tiempo';
      case 'half_time': return 'Medio Tiempo';
      case 'second_half': return '2do Tiempo';
      case 'finished': return 'Finalizado';
      default: return status;
    }
  };

  // Home Screen
  const renderHomeScreen = () => (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Partidos</Text>
      </View>
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        {matches.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="football-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>No hay partidos</Text>
            <Text style={styles.emptySubtext}>Crea un nuevo partido para comenzar</Text>
          </View>
        ) : (
          matches.map((match) => (
            <TouchableOpacity
              key={match.id}
              style={styles.matchCard}
              onPress={() => {
                setCurrentMatch(match);
                setScreen('match');
              }}
              onLongPress={() => deleteMatch(match.id)}
            >
              <View style={styles.matchCardHeader}>
                <Text style={styles.matchDate}>
                  {new Date(match.date).toLocaleDateString('es')}
                </Text>
                <View style={[styles.statusBadge, match.status === 'finished' ? styles.statusFinished : styles.statusActive]}>
                  <Text style={styles.statusText}>{getStatusLabel(match.status)}</Text>
                </View>
              </View>
              
              <View style={styles.matchTeams}>
                <View style={styles.teamRow}>
                  <Text style={styles.teamName}>{match.home_team}</Text>
                  <Text style={styles.teamScore}>{match.home_score}</Text>
                </View>
                <View style={styles.teamRow}>
                  <Text style={styles.teamName}>{match.away_team}</Text>
                  <Text style={styles.teamScore}>{match.away_score}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowNewMatchModal(true)}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );

  // Match Screen
  const renderMatchScreen = () => {
    if (!currentMatch) return null;
    
    const eventTypes: EventType[] = ['goal', 'corner', 'penalty', 'substitution', 'yellow_card', 'red_card'];
    
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setScreen('home')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Partido</Text>
          <TouchableOpacity onPress={() => setScreen('summary')} style={styles.summaryButton}>
            <Ionicons name="stats-chart" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {/* Scoreboard */}
        <View style={styles.scoreboard}>
          <View style={styles.scoreTeam}>
            <Text style={styles.scoreTeamName} numberOfLines={1}>{currentMatch.home_team}</Text>
            <Text style={styles.scoreValue}>{currentMatch.home_score}</Text>
          </View>
          <View style={styles.scoreMiddle}>
            <Text style={styles.scoreVs}>VS</Text>
            <View style={[styles.statusBadge, currentMatch.status === 'finished' ? styles.statusFinished : styles.statusActive]}>
              <Text style={styles.statusText}>{getStatusLabel(currentMatch.status)}</Text>
            </View>
          </View>
          <View style={styles.scoreTeam}>
            <Text style={styles.scoreTeamName} numberOfLines={1}>{currentMatch.away_team}</Text>
            <Text style={styles.scoreValue}>{currentMatch.away_score}</Text>
          </View>
        </View>
        
        {/* Match Status Controls */}
        <View style={styles.statusControls}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(['not_started', 'first_half', 'half_time', 'second_half', 'finished'] as MatchStatus[]).map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.statusButton,
                  currentMatch.status === status && styles.statusButtonActive
                ]}
                onPress={() => updateMatchStatus(status)}
              >
                <Text style={[
                  styles.statusButtonText,
                  currentMatch.status === status && styles.statusButtonTextActive
                ]}>
                  {getStatusLabel(status)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        
        <ScrollView style={styles.content}>
          {/* Quick Stats */}
          <View style={styles.quickStats}>
            <View style={styles.statRow}>
              <Text style={styles.statValue}>{currentMatch.home_corners}</Text>
              <Text style={styles.statLabel}>Esquinas</Text>
              <Text style={styles.statValue}>{currentMatch.away_corners}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statValue}>{currentMatch.home_penalties}</Text>
              <Text style={styles.statLabel}>Penales</Text>
              <Text style={styles.statValue}>{currentMatch.away_penalties}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statValue}>{currentMatch.home_substitutions}</Text>
              <Text style={styles.statLabel}>Cambios</Text>
              <Text style={styles.statValue}>{currentMatch.away_substitutions}</Text>
            </View>
            <View style={styles.statRow}>
              <View style={styles.cardStats}>
                <View style={[styles.cardIcon, styles.yellowCard]} />
                <Text style={styles.cardValue}>{currentMatch.home_yellow_cards}</Text>
                <View style={[styles.cardIcon, styles.redCard]} />
                <Text style={styles.cardValue}>{currentMatch.home_red_cards}</Text>
              </View>
              <Text style={styles.statLabel}>Tarjetas</Text>
              <View style={styles.cardStats}>
                <View style={[styles.cardIcon, styles.yellowCard]} />
                <Text style={styles.cardValue}>{currentMatch.away_yellow_cards}</Text>
                <View style={[styles.cardIcon, styles.redCard]} />
                <Text style={styles.cardValue}>{currentMatch.away_red_cards}</Text>
              </View>
            </View>
          </View>
          
          {/* Event Buttons */}
          <Text style={styles.sectionTitle}>Registrar Evento</Text>
          
          <View style={styles.teamsEventContainer}>
            {/* Home Team Events */}
            <View style={styles.teamEventColumn}>
              <Text style={styles.teamLabelCenter}>{currentMatch.home_team}</Text>
              <View style={styles.eventButtonsGrid}>
                {eventTypes.map((eventType) => (
                  <TouchableOpacity
                    key={`home-${eventType}`}
                    style={[styles.eventButtonSmall, { backgroundColor: getEventColor(eventType) }]}
                    onPress={() => openEventModal(eventType, 'home')}
                  >
                    <Ionicons name={getEventIcon(eventType)} size={20} color={eventType === 'yellow_card' ? '#000' : '#fff'} />
                    <Text style={[styles.eventButtonTextSmall, eventType === 'yellow_card' && { color: '#000' }]}>
                      {getEventLabel(eventType)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {/* Away Team Events */}
            <View style={styles.teamEventColumn}>
              <Text style={styles.teamLabelCenter}>{currentMatch.away_team}</Text>
              <View style={styles.eventButtonsGrid}>
                {eventTypes.map((eventType) => (
                  <TouchableOpacity
                    key={`away-${eventType}`}
                    style={[styles.eventButtonSmall, { backgroundColor: getEventColor(eventType) }]}
                    onPress={() => openEventModal(eventType, 'away')}
                  >
                    <Ionicons name={getEventIcon(eventType)} size={20} color={eventType === 'yellow_card' ? '#000' : '#fff'} />
                    <Text style={[styles.eventButtonTextSmall, eventType === 'yellow_card' && { color: '#000' }]}>
                      {getEventLabel(eventType)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          
          {/* Event Timeline */}
          <Text style={styles.sectionTitle}>Cronología</Text>
          {currentMatch.events.length === 0 ? (
            <Text style={styles.noEvents}>No hay eventos registrados</Text>
          ) : (
            [...currentMatch.events]
              .sort((a, b) => b.minute - a.minute)
              .map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventItem}
                  onLongPress={() => deleteEvent(event.id)}
                >
                  <View style={[styles.eventIcon, { backgroundColor: getEventColor(event.event_type) }]}>
                    <Ionicons
                      name={getEventIcon(event.event_type)}
                      size={16}
                      color={event.event_type === 'yellow_card' ? '#000' : '#fff'}
                    />
                  </View>
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventMinute}>{event.minute}'</Text>
                    <Text style={styles.eventTeam}>
                      {event.team === 'home' ? currentMatch.home_team : currentMatch.away_team}
                    </Text>
                    <Text style={styles.eventType}>{getEventLabel(event.event_type)}</Text>
                    {event.player_name && (
                      <Text style={styles.eventPlayer}>{event.player_name}</Text>
                    )}
                    {event.event_type === 'substitution' && (
                      <Text style={styles.eventPlayer}>
                        Sale: {event.player_out} | Entra: {event.player_in}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
          )}
          
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    );
  };

  // Summary Screen
  const renderSummaryScreen = () => {
    if (!currentMatch) return null;
    
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setScreen('match')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Resumen</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <ScrollView style={styles.content}>
          {/* Final Score */}
          <View style={styles.summaryScore}>
            <View style={styles.summaryTeam}>
              <Text style={styles.summaryTeamName}>{currentMatch.home_team}</Text>
              <Text style={styles.summaryScoreValue}>{currentMatch.home_score}</Text>
            </View>
            <Text style={styles.summaryVs}>-</Text>
            <View style={styles.summaryTeam}>
              <Text style={styles.summaryScoreValue}>{currentMatch.away_score}</Text>
              <Text style={styles.summaryTeamName}>{currentMatch.away_team}</Text>
            </View>
          </View>
          
          <View style={styles.summaryStatus}>
            <Text style={styles.summaryStatusText}>{getStatusLabel(currentMatch.status)}</Text>
            <Text style={styles.summaryDate}>
              {new Date(currentMatch.date).toLocaleDateString('es', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
          </View>
          
          {/* Statistics Table */}
          <View style={styles.statsTable}>
            <Text style={styles.statsTableTitle}>Estadísticas</Text>
            
            <View style={styles.statsRow}>
              <Text style={styles.statsHome}>{currentMatch.home_score}</Text>
              <Text style={styles.statsLabel}>Goles</Text>
              <Text style={styles.statsAway}>{currentMatch.away_score}</Text>
            </View>
            
            <View style={styles.statsRow}>
              <Text style={styles.statsHome}>{currentMatch.home_corners}</Text>
              <Text style={styles.statsLabel}>Tiros de Esquina</Text>
              <Text style={styles.statsAway}>{currentMatch.away_corners}</Text>
            </View>
            
            <View style={styles.statsRow}>
              <Text style={styles.statsHome}>{currentMatch.home_penalties}</Text>
              <Text style={styles.statsLabel}>Penales</Text>
              <Text style={styles.statsAway}>{currentMatch.away_penalties}</Text>
            </View>
            
            <View style={styles.statsRow}>
              <Text style={styles.statsHome}>{currentMatch.home_substitutions}</Text>
              <Text style={styles.statsLabel}>Cambios</Text>
              <Text style={styles.statsAway}>{currentMatch.away_substitutions}</Text>
            </View>
            
            <View style={styles.statsRow}>
              <Text style={styles.statsHome}>{currentMatch.home_yellow_cards}</Text>
              <Text style={styles.statsLabel}>Tarjetas Amarillas</Text>
              <Text style={styles.statsAway}>{currentMatch.away_yellow_cards}</Text>
            </View>
            
            <View style={styles.statsRow}>
              <Text style={styles.statsHome}>{currentMatch.home_red_cards}</Text>
              <Text style={styles.statsLabel}>Tarjetas Rojas</Text>
              <Text style={styles.statsAway}>{currentMatch.away_red_cards}</Text>
            </View>
          </View>
          
          {/* Goals Timeline */}
          {currentMatch.events.filter(e => e.event_type === 'goal').length > 0 && (
            <View style={styles.goalsSection}>
              <Text style={styles.goalsSectionTitle}>Goles</Text>
              {currentMatch.events
                .filter(e => e.event_type === 'goal')
                .sort((a, b) => a.minute - b.minute)
                .map((goal) => (
                  <View key={goal.id} style={styles.goalItem}>
                    <Ionicons name="football" size={20} color="#4CAF50" />
                    <Text style={styles.goalMinute}>{goal.minute}'</Text>
                    <Text style={styles.goalTeam}>
                      {goal.team === 'home' ? currentMatch.home_team : currentMatch.away_team}
                    </Text>
                    {goal.player_name && (
                      <Text style={styles.goalPlayer}>({goal.player_name})</Text>
                    )}
                  </View>
                ))}
            </View>
          )}
          
          <View style={{ height: 50 }} />
        </ScrollView>
      </SafeAreaView>
    );
  };

  return (
    <View style={styles.app}>
      {screen === 'home' && renderHomeScreen()}
      {screen === 'match' && renderMatchScreen()}
      {screen === 'summary' && renderSummaryScreen()}
      
      {/* New Match Modal */}
      <Modal visible={showNewMatchModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo Partido</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Equipo Local"
              placeholderTextColor="#999"
              value={homeTeam}
              onChangeText={setHomeTeam}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Equipo Visitante"
              placeholderTextColor="#999"
              value={awayTeam}
              onChangeText={setAwayTeam}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowNewMatchModal(false);
                  setHomeTeam('');
                  setAwayTeam('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={createMatch}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Crear</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      
      {/* Event Modal */}
      <Modal visible={showEventModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedEventType && getEventLabel(selectedEventType)}
            </Text>
            <Text style={styles.modalSubtitle}>
              {selectedTeam === 'home' ? currentMatch?.home_team : currentMatch?.away_team}
            </Text>
            
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Minuto:</Text>
              <TextInput
                style={[styles.input, styles.minuteInput]}
                placeholder="0"
                placeholderTextColor="#999"
                value={eventMinute}
                onChangeText={setEventMinute}
                keyboardType="numeric"
              />
            </View>
            
            {selectedEventType === 'substitution' ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Jugador que sale (opcional)"
                  placeholderTextColor="#999"
                  value={playerOut}
                  onChangeText={setPlayerOut}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Jugador que entra (opcional)"
                  placeholderTextColor="#999"
                  value={playerIn}
                  onChangeText={setPlayerIn}
                />
              </>
            ) : (
              <TextInput
                style={styles.input}
                placeholder="Nombre del jugador (opcional)"
                placeholderTextColor="#999"
                value={playerName}
                onChangeText={setPlayerName}
              />
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={closeEventModal}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={addEvent}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      )}
    </View>
  );
}

const { width } = Dimensions.get('window');
const buttonWidth = (width - 48) / 3 - 8;

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  backButton: {
    padding: 8,
  },
  summaryButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#fff',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  matchCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  matchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  matchDate: {
    color: '#888',
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusActive: {
    backgroundColor: '#4CAF50',
  },
  statusFinished: {
    backgroundColor: '#666',
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  matchTeams: {
    gap: 8,
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  teamScore: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#16213e',
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  scoreTeam: {
    flex: 1,
    alignItems: 'center',
  },
  scoreTeamName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  scoreValue: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
  },
  scoreMiddle: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  scoreVs: {
    color: '#666',
    fontSize: 16,
    marginBottom: 8,
  },
  statusControls: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#16213e',
    marginRight: 8,
  },
  statusButtonActive: {
    backgroundColor: '#4CAF50',
  },
  statusButtonText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  statusButtonTextActive: {
    color: '#fff',
  },
  quickStats: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    width: 40,
    textAlign: 'center',
  },
  statLabel: {
    color: '#888',
    fontSize: 14,
    flex: 1,
    textAlign: 'center',
  },
  cardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
    justifyContent: 'center',
  },
  cardIcon: {
    width: 12,
    height: 16,
    borderRadius: 2,
    marginRight: 4,
  },
  yellowCard: {
    backgroundColor: '#FFEB3B',
  },
  redCard: {
    backgroundColor: '#F44336',
  },
  cardValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 8,
  },
  teamLabel: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  teamsEventContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  teamEventColumn: {
    flex: 1,
  },
  teamLabelCenter: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  eventButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  eventButtonSmall: {
    width: '30%',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  eventButtonTextSmall: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  eventButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  eventButton: {
    width: buttonWidth,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  eventButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  noEvents: {
    color: '#666',
    textAlign: 'center',
    paddingVertical: 20,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  eventIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginLeft: 12,
    gap: 8,
  },
  eventMinute: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
  },
  eventTeam: {
    color: '#fff',
    fontSize: 14,
  },
  eventType: {
    color: '#888',
    fontSize: 12,
  },
  eventPlayer: {
    color: '#aaa',
    fontSize: 12,
  },
  // Summary styles
  summaryScore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  summaryTeam: {
    alignItems: 'center',
    flex: 1,
  },
  summaryTeamName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  summaryScoreValue: {
    color: '#fff',
    fontSize: 56,
    fontWeight: 'bold',
  },
  summaryVs: {
    color: '#666',
    fontSize: 32,
    paddingHorizontal: 16,
  },
  summaryStatus: {
    alignItems: 'center',
    marginBottom: 24,
  },
  summaryStatusText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryDate: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  statsTable: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
  },
  statsTableTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  statsHome: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    width: 50,
    textAlign: 'center',
  },
  statsLabel: {
    color: '#888',
    fontSize: 14,
    flex: 1,
    textAlign: 'center',
  },
  statsAway: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    width: 50,
    textAlign: 'center',
  },
  goalsSection: {
    marginTop: 24,
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
  },
  goalsSectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  goalMinute: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
  },
  goalTeam: {
    color: '#fff',
    fontSize: 14,
  },
  goalPlayer: {
    color: '#888',
    fontSize: 12,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: '#4CAF50',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#0f3460',
    borderRadius: 8,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 16,
    marginRight: 12,
  },
  minuteInput: {
    flex: 1,
    marginBottom: 0,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#333',
  },
  modalButtonConfirm: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
