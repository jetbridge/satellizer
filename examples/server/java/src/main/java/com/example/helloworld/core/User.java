package com.example.helloworld.core;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.NamedQueries;
import javax.persistence.NamedQuery;
import javax.persistence.Table;

import org.hibernate.validator.constraints.Email;
import org.hibernate.validator.constraints.NotBlank;

import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "users")
@NamedQueries({
    @NamedQuery(
        name = "com.example.helloworld.core.User.findAll",
        query = "SELECT u FROM User u"
    )
})
public class User {
	
	@Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
	private long id;
	
	@Email
	@Column(name = "email", unique = true)
	private String email;
	
	@Column(name = "password")
	private String password;
	
	@NotBlank
	@Column(name = "display_name")
	private String displayName;
	
	@Column(name = "facebook")
	private String facebook;
	
	@Column(name = "google")
	private String google;

	@Column(name = "linkedin")
	private String linkedin;
	
	@Column(name = "github")
	private String github;
	
	@Column(name = "foursquare")
	private String foursquare;

	@Column(name = "twitter")
	private String twitter;
	
	public String getEmail() {
		return email;
	}
	
	@JsonIgnore
	public String getPassword() {
		return password;
	}
	
	public String getDisplayName() {
		return displayName;
	}
	
	public String getFacebook() {
		return facebook;
	}
	
	public String getGoogle() {
		return google;
	}
	
	public String getLinkedin() {
		return linkedin;
	}
	
	public String getGithub() {
		return github;
	}
	
	public String getFoursquare() {
		return foursquare;
	}
	
	public String getTwitter() {
		return twitter;
	}
	
}
