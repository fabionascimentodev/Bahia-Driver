// src/screens/common/LogViewerScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { COLORS } from '../../theme/colors';
import { logger } from '../../services/loggerService';
import { LogEntry } from '../../services/loggerService';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';

const LogViewerScreen = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        updateLogs();
      }, 500);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const updateLogs = () => {
    const allLogs = logger.getLogs();
    if (filterLevel) {
      setLogs(allLogs.filter(log => log.level === filterLevel));
    } else {
      setLogs(allLogs);
    }
  };

  const handleFilterLevel = (level: string | null) => {
    setFilterLevel(level);
    setTimeout(updateLogs, 100);
  };

  const handleClearLogs = () => {
    Alert.alert('Limpar Logs', 'Tem certeza que deseja limpar todos os logs?', [
      {
        text: 'Cancelar',
        style: 'cancel',
      },
      {
        text: 'Limpar',
        onPress: () => {
          logger.clearLogs();
          setLogs([]);
        },
        style: 'destructive',
      },
    ]);
  };

  const handleExportLogs = async () => {
    const logsText = logger.exportLogs();
    Alert.alert('Logs Exportados', 'Logs foram preparados para exportação.\n\nVocê pode salvá-los manualmente.');
    console.log(logsText);
  };

  const getLevelColor = (level: string): string => {
    switch (level) {
      case 'ERROR':
        return '#FF6B6B';
      case 'WARN':
        return '#FFA500';
      case 'SUCCESS':
        return '#51CF66';
      case 'INFO':
        return '#4DABF7';
      case 'DEBUG':
        return '#A78BFA';
      default:
        return '#666';
    }
  };

  const getLevelIcon = (level: string): string => {
    switch (level) {
      case 'ERROR':
        return '❌';
      case 'WARN':
        return '⚠️';
      case 'SUCCESS':
        return '✅';
      case 'INFO':
        return 'ℹ️';
      case 'DEBUG':
        return '🔍';
      default:
        return '📝';
    }
  };

  const renderLogItem = ({ item }: { item: LogEntry }) => {
    const time = new Date(item.timestamp).toLocaleTimeString();
    return (
      <View style={[styles.logItem, { borderLeftColor: getLevelColor(item.level) }]}>
        <View style={styles.logHeader}>
          <Text style={styles.logTime}>{time}</Text>
          <Text style={[styles.logLevel, { color: getLevelColor(item.level) }]}>
            {getLevelIcon(item.level)} {item.level}
          </Text>
        </View>
        <Text style={styles.logModule}>[{item.module}]</Text>
        <Text style={styles.logMessage}>{item.message}</Text>
        {item.data && (
          <Text style={styles.logData}>
            📊 {JSON.stringify(item.data)}
          </Text>
        )}
        {item.error && (
          <Text style={styles.logError}>
            🔗 {item.error}
          </Text>
        )}
      </View>
    );
  };

  const errorCount = logs.filter(log => log.level === 'ERROR').length;
  const warnCount = logs.filter(log => log.level === 'WARN').length;
  const successCount = logs.filter(log => log.level === 'SUCCESS').length;

  const { footerBottom } = useResponsiveLayout();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 Monitor de Logs</Text>
      </View>

      {/* Stats */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{logs.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FFE5E5' }]}>
          <Text style={[styles.statValue, { color: '#FF6B6B' }]}>{errorCount}</Text>
          <Text style={styles.statLabel}>Erros</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FFF4E5' }]}>
          <Text style={[styles.statValue, { color: '#FFA500' }]}>{warnCount}</Text>
          <Text style={styles.statLabel}>Avisos</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#E5F9EB' }]}>
          <Text style={[styles.statValue, { color: '#51CF66' }]}>{successCount}</Text>
          <Text style={styles.statLabel}>Sucesso</Text>
        </View>
      </ScrollView>

      {/* Filtros */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, !filterLevel && styles.filterButtonActive]}
          onPress={() => handleFilterLevel(null)}
        >
          <Text style={styles.filterButtonText}>Todos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterLevel === 'ERROR' && styles.filterButtonActive]}
          onPress={() => handleFilterLevel('ERROR')}
        >
          <Text style={styles.filterButtonText}>❌ Erros</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterLevel === 'WARN' && styles.filterButtonActive]}
          onPress={() => handleFilterLevel('WARN')}
        >
          <Text style={styles.filterButtonText}>⚠️ Avisos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterLevel === 'SUCCESS' && styles.filterButtonActive]}
          onPress={() => handleFilterLevel('SUCCESS')}
        >
          <Text style={styles.filterButtonText}>✅ Sucesso</Text>
        </TouchableOpacity>
      </View>

      {/* Log List */}
      <FlatList
        data={logs}
        renderItem={renderLogItem}
        keyExtractor={(item, index) => `${item.timestamp}-${index}`}
        inverted
        contentContainerStyle={[styles.logsList, { paddingBottom: footerBottom + 80 }]}
      />

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, autoRefresh && styles.controlButtonActive]}
          onPress={() => setAutoRefresh(!autoRefresh)}
        >
          <Text style={styles.controlButtonText}>
            {autoRefresh ? '🔄 Auto ON' : '⏸️ Auto OFF'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={updateLogs}
        >
          <Text style={styles.controlButtonText}>🔄 Atualizar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleExportLogs}
        >
          <Text style={styles.controlButtonText}>💾 Exportar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlButton, styles.deleteButton]}
          onPress={handleClearLogs}
        >
          <Text style={styles.controlButtonText}>🗑️ Limpar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.whiteAreia,
  },
  header: {
    backgroundColor: COLORS.blueBahia,
    paddingVertical: 15,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.whiteAreia,
    textAlign: 'center',
  },
  statsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statCard: {
    backgroundColor: '#E8F4F8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 70,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.blueBahia,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F9F9F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  filterButtonActive: {
    backgroundColor: COLORS.blueBahia,
    borderColor: COLORS.blueBahia,
  },
  filterButtonText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  logsList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logItem: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
    borderLeftWidth: 4,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: '#E0E0E0',
    borderBottomColor: '#E0E0E0',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  logTime: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
  },
  logLevel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  logModule: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  logMessage: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  logData: {
    fontSize: 10,
    color: '#999',
    marginTop: 6,
    fontFamily: 'monospace',
  },
  logError: {
    fontSize: 10,
    color: '#FF6B6B',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  controlsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#F9F9F9',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  controlButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: COLORS.blueBahia,
    borderRadius: 6,
    marginHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#0066CC',
  },
  controlButtonText: {
    color: COLORS.whiteAreia,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  deleteButton: {
    backgroundColor: '#FF6B6B',
  },
});

export default LogViewerScreen;
