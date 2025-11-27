import React from 'react';
import {
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacityProps,
  View,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../constants/theme';

interface StyledInputProps extends TextInputProps {
  label: string;
}

export const StyledInput: React.FC<StyledInputProps> = ({ label, style, ...props }) => {
  return (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={Colors.textSecondary}
        {...props}
      />
    </View>
  );
};

interface StyledButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'google' | 'outline';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const StyledButton: React.FC<StyledButtonProps> = ({
  title,
  variant = 'primary',
  loading = false,
  icon,
  style,
  ...props
}) => {
  let buttonStyle = styles.buttonPrimary;
  let textStyle = styles.buttonTextPrimary;

  if (variant === 'google') {
    buttonStyle = styles.buttonGoogle;
    textStyle = styles.buttonTextGoogle;
  } else if (variant === 'outline') {
    buttonStyle = styles.buttonOutline;
    textStyle = styles.buttonTextOutline;
  }

  return (
    <TouchableOpacity
      style={[styles.button, buttonStyle, style, props.disabled && styles.buttonDisabled]}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'google' ? '#333' : '#fff'} />
      ) : (
        <View style={styles.buttonContent}>
          {icon}
          <Text style={[styles.buttonText, textStyle]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export const PageTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.title}>{children}</Text>
);

export const PageSubtitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.subtitle}>{children}</Text>
);

export const Message: React.FC<{ children: React.ReactNode; type?: 'success' | 'error' }> = ({
  children,
  type = 'success',
}) => (
  <View style={[styles.msg, type === 'error' && styles.msgError]}>
    <Text style={[styles.msgText, type === 'error' && styles.msgTextError]}>{children}</Text>
  </View>
);

const styles = StyleSheet.create({
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: Colors.textSecondary,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 10,
    padding: 12,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  button: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    flexDirection: 'row',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buttonPrimary: {
    backgroundColor: Colors.accentColor,
  },
  buttonGoogle: {
    backgroundColor: 'white',
    marginTop: 20,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextPrimary: {
    color: 'white',
  },
  buttonTextGoogle: {
    color: '#333',
  },
  buttonTextOutline: {
    color: 'white',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
    fontSize: 14,
  },
  msg: {
    marginTop: 20,
    padding: 10,
    borderRadius: 8,
    backgroundColor: Colors.successBg,
    borderWidth: 1,
    borderColor: Colors.successBorder,
  },
  msgError: {
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    borderColor: 'rgba(231, 76, 60, 0.3)',
  },
  msgText: {
    color: Colors.success,
    textAlign: 'center',
  },
  msgTextError: {
    color: '#e74c3c',
  },
});
